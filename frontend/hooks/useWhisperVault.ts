import { useState, useCallback } from "react";
import { useAccount, useChainId, useWalletClient } from "wagmi";
import { BrowserProvider, Contract, ZeroAddress } from "ethers";
import { encryptText, decryptText } from "./useCrypto";

// Dynamic deployment addresses cache
let deploymentCache: Record<string, { address: string; chainId: number; chainName: string }> | null = null;
let deploymentFetchPromise: Promise<Record<string, { address: string; chainId: number; chainName: string }>> | null = null;

async function fetchDeployments(): Promise<Record<string, { address: string; chainId: number; chainName: string }>> {
  // Return cached data if available
  if (deploymentCache) return deploymentCache;
  
  // Deduplicate concurrent requests
  if (deploymentFetchPromise) return deploymentFetchPromise;
  
  deploymentFetchPromise = (async () => {
    try {
      const response = await fetch('/deployments.json');
      const data = await response.json();
      deploymentCache = data.WhisperVault || {};
      return deploymentCache as Record<string, { address: string; chainId: number; chainName: string }>;
    } catch (error) {
      console.error('[WhisperVault] Failed to fetch deployments:', error);
      return {};
    } finally {
      deploymentFetchPromise = null;
    }
  })();
  
  return deploymentFetchPromise;
}

/**
 * Clear the deployment cache to force a fresh fetch
 * Useful when deployment addresses change
 */
export function clearDeploymentCache(): void {
  deploymentCache = null;
  deploymentFetchPromise = null;
}

// Contract ABI - simplified for core messaging functions
const WHISPER_VAULT_ABI = [
  "function getMessageCount(address user) view returns (uint256)",
  "function getMessageMetadata(address user, uint256 index) view returns (address sender, uint256 timestamp, bool isResponse)",
  "function getEncryptedContent(address user, uint256 index) view returns (bytes)",
  "function getMessage(address user, uint256 index) view returns (address sender, bytes encryptedContent, uint256 timestamp, bool isResponse)",
  "function getAllMessages(address user) view returns (tuple(string label, address sender, bytes encryptedContent, uint256 timestamp, bool isResponse)[])",
  "function storeMessage(bytes encryptedContent) external",
  "function storeResponse(bytes encryptedContent) external",
  "function clearMessages() external",
  "function requestDecryption() external",
  "event MessageStored(address indexed user, uint256 indexed messageIndex, uint256 timestamp, bool isResponse)",
  "event MessagesCleared(address indexed user)",
  "event DecryptionRequested(address indexed user, uint256 timestamp)",
];

/**
 * Get WhisperVault contract address for the given chainId (async)
 */
async function getContractAddress(chainId: number | undefined): Promise<string | null> {
  if (!chainId) return null;
  
  const deployments = await fetchDeployments();
  const entry = deployments[chainId.toString()];
  if (!entry || !entry.address || entry.address === ZeroAddress || entry.address === "0x0000000000000000000000000000000000000000") {
    return null;
  }
  
  return entry.address;
}

export interface Message {
  id: number;
  sender: string;
  encryptedContent: string;
  timestamp: number;
  isResponse: boolean;
  decryptedText?: string;
}

function generateAutoResponse(userMessage: string): string {
  const responses = [
    "Thank you for your encrypted message. Your data is secure.",
    "Message received and stored on-chain with FHE protection.",
    "Your private communication has been recorded securely.",
    "Acknowledged. This conversation is end-to-end encrypted.",
    "Message stored. Only you can decrypt this conversation.",
  ];

  // Simple response selection based on message length
  const index = userMessage.length % responses.length;
  return responses[index];
}

export function useWhisperVault() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get contract instance
  const getContract = useCallback(async () => {
    if (!walletClient || !chainId) return null;

    const contractAddress = await getContractAddress(chainId);
    if (!contractAddress) {
      console.warn(`No contract deployed on chain ${chainId}. Using demo mode with localStorage.`);
      return null;
    }

    console.log(`[WhisperVault] Using contract at ${contractAddress} on chain ${chainId}`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const provider = new BrowserProvider(walletClient as any);
    const signer = await provider.getSigner();
    return new Contract(contractAddress, WHISPER_VAULT_ABI, signer);
  }, [walletClient, chainId]);

  // Load messages from contract
  const loadMessages = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      setError(null);

      const contract = await getContract();
      if (!contract) {
        // Demo mode - use local storage
        const stored = localStorage.getItem(`whisperlink-${address}`);
        if (stored) {
          try {
            setMessages(JSON.parse(stored));
          } catch (parseErr) {
            console.error("Failed to parse stored messages:", parseErr);
            localStorage.removeItem(`whisperlink-${address}`);
            setMessages([]);
          }
        }
        return;
      }

      // Use batch loading for better performance
      const allMessages = await contract.getAllMessages(address);
      const loadedMessages: Message[] = allMessages.map((msg: { label: string; sender: string; encryptedContent: string; timestamp: bigint; isResponse: boolean }, index: number) => ({
        id: index,
        sender: msg.sender,
        encryptedContent: msg.encryptedContent as string,
        timestamp: Number(msg.timestamp),
        isResponse: msg.isResponse,
      }));

      setMessages(loadedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error("Failed to load messages:", err);
      
      // Check for specific contract errors
      if (errorMessage.includes("missing revert data") || errorMessage.includes("CALL_EXCEPTION")) {
        setError("Contract not available on this network. Please check your connection.");
      } else {
        setError(`Failed to load messages: ${errorMessage}`);
      }
      
      // Fallback to local storage
      const stored = localStorage.getItem(`whisperlink-${address}`);
      if (stored) {
        try {
          setMessages(JSON.parse(stored));
        } catch (parseErr) {
          console.error("Failed to parse stored messages:", parseErr);
          setMessages([]);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [address, getContract]);

  // Send a message
  const sendMessage = useCallback(
    async (messageText: string, password: string) => {
      if (!address) throw new Error("Not connected");

      try {
        setLoading(true);
        setError(null);

        // Encrypt user message
        const encryptedMessage = await encryptText(messageText, password);

        // Generate and encrypt auto-response
        const responseText = generateAutoResponse(messageText);
        const encryptedResponse = await encryptText(responseText, password);

        const now = Math.floor(Date.now() / 1000);

        // Try to use contract, fallback to local storage
        const contract = await getContract();
        if (contract) {
          // Convert hex string to bytes for contract
          const messageBytes = "0x" + encryptedMessage;
          const responseBytes = "0x" + encryptedResponse;

          // Store user message on-chain
          const tx1 = await contract.storeMessage(messageBytes);
          await tx1.wait();

          // Store auto-response on-chain
          const tx2 = await contract.storeResponse(responseBytes);
          await tx2.wait();

          // Reload messages from chain
          await loadMessages();
          return;
        }

        // Store locally for demo mode
        const newMessages = [
          ...messages,
          {
            id: messages.length,
            sender: address,
            encryptedContent: encryptedMessage,
            timestamp: now,
            isResponse: false,
          },
          {
            id: messages.length + 1,
            sender: "system",
            encryptedContent: encryptedResponse,
            timestamp: now + 1,
            isResponse: true,
          },
        ];

        setMessages(newMessages);
        localStorage.setItem(`whisperlink-${address}`, JSON.stringify(newMessages));
      } catch (err) {
        console.error("Failed to send message:", err);
        setError(err instanceof Error ? err.message : "Failed to send");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [address, messages, getContract, loadMessages]
  );

  // Decrypt all messages - on-chain verification is optional
  const decryptAllMessages = useCallback(
    async (password: string) => {
      try {
        setLoading(true);
        setError(null);

        if (messages.length === 0) {
          throw new Error("No messages to decrypt");
        }

        // Step 1: Try to send on-chain decryption request (optional - for audit trail)
        const contract = await getContract();
        if (contract) {
          console.log("[Decrypt] Attempting on-chain decryption request (optional)...");
          
          try {
            // Call requestDecryption - this is a write function that triggers MetaMask
            const tx = await contract.requestDecryption();
            console.log("[Decrypt] Waiting for transaction confirmation...");
            await tx.wait();
            console.log("[Decrypt] Decryption request confirmed on-chain");
          } catch (contractErr) {
            // On-chain verification failed, but continue with local decryption
            console.warn("[Decrypt] On-chain request failed, continuing with local decryption:", contractErr);
            // Don't throw error - local decryption can still proceed
          }
        } else {
          console.log("[Decrypt] No contract available, using local decryption only");
        }

        // Step 2: Decrypt locally (works independently of on-chain verification)
        console.log("[Decrypt] Proceeding with local decryption...");
        
        const decryptedMessages = await Promise.all(
          messages.map(async (msg: Message) => {
            try {
              console.log(`[Decrypt] Message ${msg.id}, content preview:`, msg.encryptedContent?.substring(0, 50));
              const decrypted = await decryptText(msg.encryptedContent, password);
              console.log(`[Decrypt] Message ${msg.id} decrypted:`, decrypted);
              return { ...msg, decryptedText: decrypted };
            } catch (err) {
              console.error(`[Decrypt] Message ${msg.id} failed:`, err);
              return { ...msg, decryptedText: "[Decryption failed]" };
            }
          })
        );

        setMessages(decryptedMessages);
      } catch (err) {
        console.error("Failed to decrypt:", err);
        setError(err instanceof Error ? err.message : "Decryption failed");
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [messages, getContract]
  );

  // Clear all messages
  const clearMessages = useCallback(async () => {
    if (!address) return;

    try {
      setLoading(true);
      const contract = await getContract();
      if (contract) {
        const tx = await contract.clearMessages();
        await tx.wait();
      }

      setMessages([]);
      localStorage.removeItem(`whisperlink-${address}`);
    } catch (err) {
      console.error("Failed to clear messages:", err);
      setError(err instanceof Error ? err.message : "Failed to clear");
    } finally {
      setLoading(false);
    }
  }, [address, getContract]);

  return {
    messages,
    loading,
    error,
    isConnected,
    address,
    chainId,
    loadMessages,
    sendMessage,
    decryptAllMessages,
    clearMessages,
  };
}
