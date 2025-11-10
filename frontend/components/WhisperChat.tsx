"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useSignMessage } from "wagmi";
import { useWhisperVault } from "@/hooks/useWhisperVault";
import {
  Lock,
  Unlock,
  Send,
  RefreshCw,
  Shield,
  MessageSquare, ShieldAlert,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  LogOut,
  Copy,
  Check,
  Zap,
  Globe,
  ShieldCheck,
  Fingerprint,
  Radio,
  ChevronDown,
} from "lucide-react";

/* label support */
/* label support */
export default function WhisperChat() {
  const { isConnected, address, chainId } = useAccount();
  const {
    messages,
    loading,
    error,
    loadMessages,
    sendMessage,
    decryptAllMessages,
  } = useWhisperVault();
  
  const [prevChainId, setPrevChainId] = useState<number | undefined>(undefined);
  const [messageInput, setMessageInput] = useState("");
  const [password, setPassword] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { signMessageAsync } = useSignMessage();
  
  const getPasswordStrength = (pwd: string): { level: number; label: string; color: string } => {
    if (!pwd || pwd.length < 4) return { level: 0, label: "", color: "" };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    
    if (score <= 2) return { level: 1, label: "Weak", color: "#ef4444" };
    if (score <= 3) return { level: 2, label: "Medium", color: "#f59e0b" };
    return { level: 3, label: "Strong", color: "#22c55e" };
  };
  
  const passwordStrength = getPasswordStrength(authPassword);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleLockVault = useCallback(() => {
    setIsAuthenticated(true);
    setPassword("");
    setAuthPassword("");
    setAuthError(null);
    setSendError(null);
  }, []);

  useEffect(() => {
    if (!isConnected) {
      setIsAuthenticated(true);
      setAuthPassword("");
      setPassword("");
    }
  }, [isConnected]);

  useEffect(() => {
    if (chainId && prevChainId && chainId !== prevChainId && isAuthenticated) {
      setSendError(null);
      loadMessages();
    }
    setPrevChainId(chainId);
  }, [chainId, prevChainId, isAuthenticated, loadMessages]);

  useEffect(() => {
    if (isConnected && address && isAuthenticated) {
      loadMessages();
    }
  }, [isConnected, address, isAuthenticated, loadMessages]);

  const handleAuthenticate = useCallback(async () => {
    if (!authPassword.trim()) {
      setAuthError("Please enter a password");
      return;
    }
    if (authPassword.length < 6) {
      setAuthError("Password must be at least 6 characters");
      return;
    }
    try {
      setIsAuthenticating(true);
      setAuthError(null);
      const timestamp = Date.now();
      const message = `WhisperLink Authentication\n\nI am signing in to WhisperLink with my encryption key.\n\nTimestamp: ${timestamp}\nAddress: ${address}`;
      await signMessageAsync({ message });
      setPassword(authPassword);
      setIsAuthenticated(true);
    } catch (err) {
      console.error("Authentication failed:", err);
      setAuthError(err instanceof Error ? err.message : "Signature rejected");
    } finally {
      setIsAuthenticating(false);
    }
  }, [authPassword, address, signMessageAsync]);

  const MAX_MESSAGE_LENGTH = 500;
  
  const handleSend = async () => {
    if (isSending) return;
    if (!messageInput.trim() || !password.trim()) {
      setSendError("Please enter both message and password");
      return;
    }
    if (messageInput.length > MAX_MESSAGE_LENGTH) {
      setSendError(`Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters allowed.`);
      return;
    }
    try {
      setIsSending(true);
      setSendError(null);
      await sendMessage(messageInput, password);
      setMessageInput("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setIsSending(false);
    }
  };

  const handleDecryptAll = async () => {
    if (!password.trim()) {
      setSendError("Please enter password to decrypt");
      return;
    }
    try {
      setIsDecrypting(true);
      setSendError(null);
      await decryptAllMessages(password);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to decrypt");
    } finally {
      setIsDecrypting(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateHex = (hex: string) => {
    if (hex.length <= 24) return hex;
    return hex.slice(0, 12) + "..." + hex.slice(-10);
  };

  const handleCopyContent = async (id: number, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Feature cards data
  const features = [
    { icon: ShieldCheck, title: "End-to-End Encrypted", desc: "AES-256 encryption" },
    { icon: Globe, title: "On-Chain Storage", desc: "Immutable & secure" },
    { icon: Fingerprint, title: "Wallet Auth", desc: "Sign to access" },
    { icon: Zap, title: "Instant Delivery", desc: "Real-time messaging" },
  ];

  return (
    <div className="flex flex-col min-h-screen w-full relative z-10">
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b border-cyan-500/20">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-xl opacity-20 blur-lg animate-pulse" />
                <div className="relative w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-cyan-500/30 flex items-center justify-center glow-cyan">
                  <MessageSquare className="w-6 h-6 text-cyan-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center border border-cyan-500/50">
                    <Lock className="w-2.5 h-2.5 text-cyan-400" />
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                  WhisperLink
                </h1>
                <p className="text-xs text-slate-400">Encrypted Messaging</p>
              </div>
            </div>

            {/* Center Stats */}
            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-6">
                <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full">
                  <Radio className="w-4 h-4 text-green-400 animate-pulse" />
                  <span className="text-sm text-slate-300">Live</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 glass-card rounded-full">
                  <Shield className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-slate-300">{messages.length} Messages</span>
                </div>
              </div>
            )}

            {/* Connect Button */}
            <ConnectButton
              accountStatus={{ smallScreen: "avatar", largeScreen: "full" }}
              chainStatus={isConnected ? "icon" : "none"}
              showBalance={false}
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {!isConnected ? (
          /* Welcome Screen */
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
            <div className="max-w-4xl w-full">
              {/* Hero Section */}
              <div className="text-center mb-12">
                <div className="inline-flex items-center gap-2 px-4 py-2 glass-card rounded-full mb-6">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-sm text-cyan-300">Powered by Blockchain Encryption</span>
                </div>
                <h1 className="text-5xl md:text-6xl font-bold mb-6">
                  <span className="bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent">
                    Private Conversations
                  </span>
                  <br />
                  <span className="text-white">On The Blockchain</span>
                </h1>
                <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-8">
                  Your messages are encrypted client-side and stored securely on-chain. 
                  Only you hold the keys to your conversations.
                </p>
                <div className="flex justify-center">
                  <ConnectButton />
                </div>
              </div>

              {/* Feature Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {features.map((feature, i) => (
                  <div key={i} className="glass-card rounded-2xl p-6 text-center hover:glow-cyan transition-all duration-300 group">
                    <div className="w-12 h-12 mx-auto mb-4 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                      <feature.icon className="w-6 h-6 text-cyan-400" />
                    </div>
                    <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                    <p className="text-sm text-slate-400">{feature.desc}</p>
                  </div>
                ))}
              </div>

              {/* Security Badge */}
              <div className="mt-12 flex justify-center">
                <div className="flex items-center gap-4 px-6 py-3 glass-card rounded-full">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                  <span className="text-sm text-slate-300">Military-grade AES-256 encryption</span>
                  <div className="w-px h-4 bg-slate-600" />
                  <Lock className="w-5 h-5 text-cyan-400" />
                  <span className="text-sm text-slate-300">Zero-knowledge architecture</span>
                </div>
              </div>
            </div>
          </div>
        ) : !isAuthenticated ? (
          /* Authentication Screen */
          <div className="min-h-[calc(100vh-80px)] flex items-center justify-center p-4">
            <div className="max-w-md w-full">
              <div className="glass-card rounded-3xl p-8 relative overflow-hidden">
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-cyan-500/20 to-transparent rounded-full blur-2xl" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-tr from-purple-500/20 to-transparent rounded-full blur-2xl" />
                
                <div className="relative z-10 text-center space-y-6">
                  {/* Animated Lock Icon */}
                  <div className="relative mx-auto w-24 h-24">
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-full opacity-20 blur-xl animate-pulse" />
                    <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-pulse-ring" />
                    <div className="relative w-full h-full bg-gradient-to-br from-slate-800 to-slate-900 rounded-full flex items-center justify-center border border-cyan-500/50 glow-cyan">
                      <KeyRound className="w-10 h-10 text-cyan-400" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white">Unlock Your Vault</h2>
                    <p className="text-slate-400">
                      Enter your encryption password and sign with your wallet
                    </p>
                  </div>

                  {/* Connected Address */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <span className="text-sm text-slate-300">
                      {address?.slice(0, 6)}...{address?.slice(-4)}
                    </span>
                  </div>

                  {/* Error Display */}
                  {authError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      {authError}
                    </div>
                  )}

                  {/* Password Input */}
                  <div className="space-y-4">
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                      <input
                        type={showAuthPassword ? "text" : "password"}
                        placeholder="Enter encryption password..."
                        className="w-full pl-12 pr-12 py-4 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 input-cyber transition-all"
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
                        autoComplete="off"
                        disabled={isAuthenticating}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAuthPassword(!showAuthPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showAuthPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>

                    {/* Password Strength */}
                    {authPassword && (
                      <div className="space-y-2">
                        <div className="flex gap-1">
                          {[1, 2, 3].map((level) => (
                            <div
                              key={level}
                              className="h-1.5 flex-1 rounded-full transition-all duration-300"
                              style={{
                                backgroundColor: passwordStrength.level >= level ? passwordStrength.color : "rgb(51, 65, 85)"
                              }}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-right" style={{ color: passwordStrength.color }}>
                          {passwordStrength.label}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleAuthenticate}
                      disabled={isAuthenticating || !authPassword.trim() || authPassword.length < 6}
                      className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold transition-all glow-cyan btn-cyber flex items-center justify-center gap-2"
                    >
                      {isAuthenticating ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          <span>Waiting for signature...</span>
                        </>
                      ) : (
                        <>
                          <LogIn className="w-5 h-5" />
                          <span>Sign In with Wallet</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-500">
                    Your password never leaves your browser. It&apos;s used for local encryption only.
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Chat Interface */
          <div className="h-[calc(100vh-80px)] flex flex-col max-w-4xl mx-auto">
            {/* Error Display */}
            {(error || sendError) && (
              <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4" />
                {error || sendError}
              </div>
            )}

            {/* Control Bar */}
            <div className="p-4 border-b border-slate-700/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-full">
                    <Unlock className="w-4 h-4 text-green-400" />
                    <span className="text-sm text-green-400">Vault Unlocked</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDecryptAll}
                    disabled={loading || isDecrypting || messages.length === 0}
                    className="px-4 py-2 glass-card hover:bg-slate-700/50 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-all flex items-center gap-2"
                  >
                    {isDecrypting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin" />
                        <span>Decrypting...</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-4 h-4 text-cyan-400" />
                        <span>Decrypt All</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleLockVault}
                    className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-xl text-red-400 text-sm font-medium transition-all flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Lock</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto glass-card rounded-2xl flex items-center justify-center">
                      <MessageSquare className="w-10 h-10 text-slate-500" />
                    </div>
                    <div>
                      <p className="text-slate-400 font-medium">No messages yet</p>
                      <p className="text-sm text-slate-500">
                        Send your first encrypted message below
                      </p>
                    </div>
                    <ChevronDown className="w-6 h-6 text-slate-500 mx-auto animate-bounce" />
                  </div>
                </div>
              ) : (
                <>
                  {/* Refresh Button */}
                  <div className="flex justify-center">
                    <button
                      onClick={loadMessages}
                      disabled={loading}
                      className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-2 glass-card rounded-full"
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                      Refresh Messages
                    </button>
                  </div>

                  {/* Message List */}
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex group ${msg.isResponse ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] ${
                          msg.isResponse ? "message-system" : "message-user"
                        } px-5 py-3 ${!msg.decryptedText ? "scan-line" : ""}`}
                      >
                        {/* Message Content */}
                        <div className="space-y-2">
                          {msg.decryptedText ? (
                            <div className="flex items-start gap-2">
                              <p className={`text-sm flex-1 ${msg.isResponse ? "text-white" : "text-slate-900"}`}>
                                {msg.decryptedText}
                              </p>
                              <button
                                onClick={() => handleCopyContent(msg.id, msg.decryptedText || "")}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                                title="Copy message"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <Copy className={`w-3.5 h-3.5 ${msg.isResponse ? "text-slate-400" : "text-slate-600"}`} />
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 encrypted-content p-2 rounded-lg">
                              <Lock className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
                              <p className="font-mono text-xs text-cyan-300/70 break-all flex-1">
                                {truncateHex(msg.encryptedContent)}
                              </p>
                              <button
                                onClick={() => handleCopyContent(msg.id, msg.encryptedContent)}
                                className="opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded flex-shrink-0"
                                title="Copy encrypted content"
                              >
                                {copiedId === msg.id ? (
                                  <Check className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                                )}
                              </button>
                            </div>
                          )}

                          {/* Message Footer */}
                          <div className={`flex items-center gap-2 text-xs ${
                            msg.isResponse ? "text-slate-400" : "text-slate-700"
                          }`}>
                            <span className="font-medium">{msg.isResponse ? "System" : "You"}</span>
                            <span>·</span>
                            <span>{formatTime(msg.timestamp)}</span>
                            {msg.decryptedText && (
                              <>
                                <span>·</span>
                                <span className="text-green-500 flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3" />
                                  Decrypted
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-slate-700/50 glass">
              <div className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Type your encrypted message..."
                    className="w-full px-5 py-4 bg-slate-800/50 border border-slate-700 rounded-2xl text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 input-cyber transition-all pr-12"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    disabled={loading}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <Lock className="w-4 h-4 text-cyan-500/50" />
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={loading || isSending || !messageInput.trim()}
                  className="p-4 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-white transition-all glow-cyan btn-cyber"
                >
                  {(loading || isSending) ? (
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="w-6 h-6" />
                  )}
                </button>
              </div>

              {/* Status Bar */}
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span>Connected: {address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={messageInput.length > MAX_MESSAGE_LENGTH ? "text-red-400" : ""}>
                    {messageInput.length}/{MAX_MESSAGE_LENGTH}
                  </span>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-cyan-500/10 rounded-full">
                    <Shield className="w-3 h-3 text-cyan-400" />
                    <span className="text-cyan-400">E2E Encrypted</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="glass border-t border-slate-700/50 py-4">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between text-sm text-slate-500">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-500" />
              <span>WhisperLink Protocol</span>
            </div>
            <div className="flex items-center gap-4">
              <span>Powered by FHE Technology</span>
              <div className="w-px h-4 bg-slate-700" />
              <span>© 2024</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
