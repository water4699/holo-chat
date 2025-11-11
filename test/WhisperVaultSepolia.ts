import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { WhisperVault } from "../types";
import { expect } from "chai";

type Signers = {
  alice: HardhatEthersSigner;
};

// Helper function to create AES-encrypted message (simulated for tests)
function encryptMessage(message: string): string {
  return ethers.hexlify(ethers.toUtf8Bytes(message));
}

describe("WhisperVaultSepolia", function () {
  let signers: Signers;
  let whisperVaultContract: WhisperVault;
  let whisperVaultContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const WhisperVaultDeployment = await deployments.get("WhisperVault");
      whisperVaultContractAddress = WhisperVaultDeployment.address;
      whisperVaultContract = await ethers.getContractAt("WhisperVault", WhisperVaultDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("store and retrieve an encrypted message", async function () {
    steps = 5;

    this.timeout(4 * 60000);

    // Create test message (AES-encrypted client-side)
    const originalText = "Hello Sepolia!";
    const encryptedContent = encryptMessage(originalText);

    progress(`Call storeMessage() WhisperVault=${whisperVaultContractAddress} signer=${signers.alice.address}...`);
    const tx = await whisperVaultContract
      .connect(signers.alice)
      .storeMessage(encryptedContent);
    await tx.wait();

    progress(`Call WhisperVault.getMessageCount()...`);
    const messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.be.gt(0);
    progress(`Message count: ${messageCount}`);

    const latestIndex = Number(messageCount) - 1;

    progress(`Call WhisperVault.getEncryptedContent(${latestIndex})...`);
    const storedContent = await whisperVaultContract.getEncryptedContent(
      signers.alice.address,
      latestIndex
    );
    expect(storedContent).to.eq(encryptedContent);
    progress(`Retrieved encrypted content matches stored content`);

    // In production, client would decrypt with AES key
    const decryptedText = ethers.toUtf8String(storedContent);
    progress(`Message content: "${decryptedText}"`);

    expect(decryptedText).to.eq(originalText);
  });

  it("store message and auto-response sequence", async function () {
    steps = 8;

    this.timeout(5 * 60000);

    // Get initial count
    progress(`Getting initial message count...`);
    const initialCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    progress(`Initial count: ${initialCount}`);

    // Store user message
    const userMessage = encryptMessage("User question");

    progress("Storing user message...");
    let tx = await whisperVaultContract
      .connect(signers.alice)
      .storeMessage(userMessage);
    await tx.wait();

    // Store auto-response
    const responseMessage = encryptMessage("System response");

    progress("Storing response message...");
    tx = await whisperVaultContract
      .connect(signers.alice)
      .storeResponse(responseMessage);
    await tx.wait();

    // Verify count increased by 2
    progress(`Getting final message count...`);
    const finalCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(finalCount - initialCount).to.eq(2n);
    progress(`Final count: ${finalCount} (added 2 messages)`);

    // Verify message types
    const userMsgIndex = Number(finalCount) - 2;
    const responseMsgIndex = Number(finalCount) - 1;

    progress(`Verifying message metadata...`);
    const [, , isResponseUser] = await whisperVaultContract.getMessageMetadata(
      signers.alice.address,
      userMsgIndex
    );
    const [, , isResponseSystem] = await whisperVaultContract.getMessageMetadata(
      signers.alice.address,
      responseMsgIndex
    );

    expect(isResponseUser).to.eq(false);
    expect(isResponseSystem).to.eq(true);
    progress(`Message types verified: user message and system response`);
  });
});
