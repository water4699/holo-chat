import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { WhisperVault, WhisperVault__factory } from "../types";
import { expect } from "chai";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

// Helper function to create AES-encrypted message (simulated for tests)
function encryptMessage(message: string): string {
  // In production, this would use actual AES-GCM encryption
  // For tests, we just encode the message as hex bytes
  return ethers.hexlify(ethers.toUtf8Bytes(message));
}

async function deployFixture() {
  const factory = (await ethers.getContractFactory("WhisperVault")) as WhisperVault__factory;
  const whisperVaultContract = (await factory.deploy()) as WhisperVault;
  const whisperVaultContractAddress = await whisperVaultContract.getAddress();

  return { whisperVaultContract, whisperVaultContractAddress };
}

describe("WhisperVault", function () {
  let signers: Signers;
  let whisperVaultContract: WhisperVault;
  let whisperVaultContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    ({ whisperVaultContract, whisperVaultContractAddress } = await deployFixture());
  });

  it("should have zero messages after deployment", async function () {
    const messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.eq(0);
  });

  it("should store an encrypted message", async function () {
    const encryptedContent = encryptMessage("Hello, encrypted world!");

    const tx = await whisperVaultContract
      .connect(signers.alice)
      .storeMessage(encryptedContent);
    await tx.wait();

    const messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.eq(1);

    const [sender, timestamp, isResponse] = await whisperVaultContract.getMessageMetadata(
      signers.alice.address,
      0
    );
    expect(sender).to.eq(signers.alice.address);
    expect(isResponse).to.eq(false);
    expect(timestamp).to.be.gt(0);
  });

  it("should store and retrieve encrypted content", async function () {
    const originalMessage = "Secret message content";
    const encryptedContent = encryptMessage(originalMessage);

    await whisperVaultContract.connect(signers.alice).storeMessage(encryptedContent);

    const storedContent = await whisperVaultContract.getEncryptedContent(
      signers.alice.address,
      0
    );
    expect(storedContent).to.eq(encryptedContent);
  });

  it("should store an auto-response message", async function () {
    const encryptedContent = encryptMessage("Auto-response message");

    const tx = await whisperVaultContract
      .connect(signers.alice)
      .storeResponse(encryptedContent);
    await tx.wait();

    const messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.eq(1);

    const [sender, timestamp, isResponse] = await whisperVaultContract.getMessageMetadata(
      signers.alice.address,
      0
    );
    expect(sender).to.eq(whisperVaultContractAddress);
    expect(isResponse).to.eq(true);
    expect(timestamp).to.be.gt(0);
  });

  it("should get full message data", async function () {
    const encryptedContent = encryptMessage("Full message test");
    await whisperVaultContract.connect(signers.alice).storeMessage(encryptedContent);

    const [sender, content, timestamp, isResponse] = await whisperVaultContract.getMessage(
      signers.alice.address,
      0
    );

    expect(sender).to.eq(signers.alice.address);
    expect(content).to.eq(encryptedContent);
    expect(timestamp).to.be.gt(0);
    expect(isResponse).to.eq(false);
  });

  it("should store multiple messages in sequence", async function () {
    // Store first message
    await whisperVaultContract.connect(signers.alice).storeMessage(encryptMessage("First message"));

    // Store response
    await whisperVaultContract.connect(signers.alice).storeResponse(encryptMessage("Auto response"));

    // Store second message
    await whisperVaultContract.connect(signers.alice).storeMessage(encryptMessage("Second message"));

    // Verify total count
    const messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.eq(3);

    // Verify message order and types
    const [, , isResponse0] = await whisperVaultContract.getMessageMetadata(signers.alice.address, 0);
    const [, , isResponse1] = await whisperVaultContract.getMessageMetadata(signers.alice.address, 1);
    const [, , isResponse2] = await whisperVaultContract.getMessageMetadata(signers.alice.address, 2);

    expect(isResponse0).to.eq(false);
    expect(isResponse1).to.eq(true);
    expect(isResponse2).to.eq(false);
  });

  it("should get all messages for a user", async function () {
    const messages = ["First", "Second", "Third"];

    for (const msg of messages) {
      await whisperVaultContract.connect(signers.alice).storeMessage(encryptMessage(msg));
    }

    const allMessages = await whisperVaultContract.getAllMessages(signers.alice.address);
    expect(allMessages.length).to.eq(3);
  });

  it("should clear all messages for a user", async function () {
    await whisperVaultContract.connect(signers.alice).storeMessage(encryptMessage("Message to clear"));

    let messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.eq(1);

    const tx = await whisperVaultContract.connect(signers.alice).clearMessages();
    await tx.wait();

    messageCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    expect(messageCount).to.eq(0);
  });

  it("should emit MessagesCleared event", async function () {
    await whisperVaultContract.connect(signers.alice).storeMessage(encryptMessage("Test"));

    await expect(whisperVaultContract.connect(signers.alice).clearMessages())
      .to.emit(whisperVaultContract, "MessagesCleared")
      .withArgs(signers.alice.address);
  });

  it("should keep messages isolated between users", async function () {
    await whisperVaultContract.connect(signers.alice).storeMessage(encryptMessage("Alice's message"));
    await whisperVaultContract.connect(signers.bob).storeMessage(encryptMessage("Bob's message"));

    const aliceCount = await whisperVaultContract.getMessageCount(signers.alice.address);
    const bobCount = await whisperVaultContract.getMessageCount(signers.bob.address);

    expect(aliceCount).to.eq(1);
    expect(bobCount).to.eq(1);
  });

  it("should revert on empty message", async function () {
    await expect(
      whisperVaultContract.connect(signers.alice).storeMessage("0x")
    ).to.be.revertedWith("Empty message");
  });

  it("should revert on out of bounds message index", async function () {
    await expect(
      whisperVaultContract.getMessageMetadata(signers.alice.address, 0)
    ).to.be.revertedWith("Message index out of bounds");
  });

  it("should allow reading other users messages (public vault)", async function () {
    await whisperVaultContract.connect(signers.bob).storeMessage(encryptMessage("Bob's public message"));

    // Alice can read Bob's message metadata
    const [sender, , isResponse] = await whisperVaultContract.getMessageMetadata(
      signers.bob.address,
      0
    );
    expect(sender).to.eq(signers.bob.address);
    expect(isResponse).to.eq(false);
  });
});
