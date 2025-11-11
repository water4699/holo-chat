import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

/**
 * Tutorial: Deploy and Interact Locally (--network localhost)
 * ===========================================================
 *
 * 1. From a separate terminal window:
 *
 *   npx hardhat node
 *
 * 2. Deploy the WhisperVault contract
 *
 *   npx hardhat --network localhost deploy
 *
 * 3. Interact with the WhisperVault contract
 *
 *   npx hardhat --network localhost whisper:address
 *   npx hardhat --network localhost whisper:count --user <address>
 *   npx hardhat --network localhost whisper:store --message "Hello World"
 *   npx hardhat --network localhost whisper:clear
 *
 *
 * Tutorial: Deploy and Interact on Sepolia (--network sepolia)
 * ===========================================================
 *
 * 1. Deploy the WhisperVault contract
 *
 *   npx hardhat --network sepolia deploy
 *
 * 2. Interact with the WhisperVault contract
 *
 *   npx hardhat --network sepolia whisper:address
 *   npx hardhat --network sepolia whisper:count --user <address>
 *
 */

/**
 * Example:
 *   - npx hardhat --network localhost whisper:address
 *   - npx hardhat --network sepolia whisper:address
 */
task("whisper:address", "Prints the WhisperVault address").setAction(async function (
  _taskArguments: TaskArguments,
  hre
) {
  const { deployments } = hre;

  const whisperVault = await deployments.get("WhisperVault");

  console.log("WhisperVault address is " + whisperVault.address);
});

/**
 * Example:
 *   - npx hardhat --network localhost whisper:count --user 0x...
 *   - npx hardhat --network sepolia whisper:count --user 0x...
 */
task("whisper:count", "Gets the message count for a user")
  .addOptionalParam("address", "Optionally specify the WhisperVault contract address")
  .addParam("user", "The user address to check message count for")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const WhisperVaultDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("WhisperVault");
    console.log(`WhisperVault: ${WhisperVaultDeployment.address}`);

    const whisperVaultContract = await ethers.getContractAt("WhisperVault", WhisperVaultDeployment.address);

    const messageCount = await whisperVaultContract.getMessageCount(taskArguments.user);
    console.log(`Message count for ${taskArguments.user}: ${messageCount}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost whisper:store --message "Hello"
 *   - npx hardhat --network sepolia whisper:store --message "Hello"
 */
task("whisper:store", "Stores an encrypted message")
  .addOptionalParam("address", "Optionally specify the WhisperVault contract address")
  .addParam("message", "The message to encrypt and store")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const WhisperVaultDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("WhisperVault");
    console.log(`WhisperVault: ${WhisperVaultDeployment.address}`);

    const signers = await ethers.getSigners();
    const whisperVaultContract = await ethers.getContractAt("WhisperVault", WhisperVaultDeployment.address);

    // Encode message as hex bytes (simulating client-side AES encryption)
    const messageBytes = ethers.toUtf8Bytes(taskArguments.message);
    const messageHex = ethers.hexlify(messageBytes);

    console.log("Storing message...");
    const tx = await whisperVaultContract
      .connect(signers[0])
      .storeMessage(messageHex);
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    const newCount = await whisperVaultContract.getMessageCount(signers[0].address);
    console.log(`Message stored! Total messages: ${newCount}`);
  });

/**
 * Example:
 *   - npx hardhat --network localhost whisper:clear
 *   - npx hardhat --network sepolia whisper:clear
 */
task("whisper:clear", "Clears all messages for the current user")
  .addOptionalParam("address", "Optionally specify the WhisperVault contract address")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const WhisperVaultDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("WhisperVault");
    console.log(`WhisperVault: ${WhisperVaultDeployment.address}`);

    const signers = await ethers.getSigners();
    const whisperVaultContract = await ethers.getContractAt("WhisperVault", WhisperVaultDeployment.address);

    console.log("Clearing messages...");
    const tx = await whisperVaultContract.connect(signers[0]).clearMessages();
    console.log(`Wait for tx:${tx.hash}...`);

    const receipt = await tx.wait();
    console.log(`tx:${tx.hash} status=${receipt?.status}`);

    console.log("All messages cleared!");
  });

/**
 * Example:
 *   - npx hardhat --network localhost whisper:metadata --user 0x... --index 0
 *   - npx hardhat --network sepolia whisper:metadata --user 0x... --index 0
 */
task("whisper:metadata", "Gets message metadata")
  .addOptionalParam("address", "Optionally specify the WhisperVault contract address")
  .addParam("user", "The user address")
  .addParam("index", "The message index")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments } = hre;

    const WhisperVaultDeployment = taskArguments.address
      ? { address: taskArguments.address }
      : await deployments.get("WhisperVault");
    console.log(`WhisperVault: ${WhisperVaultDeployment.address}`);

    const whisperVaultContract = await ethers.getContractAt("WhisperVault", WhisperVaultDeployment.address);

    const index = parseInt(taskArguments.index);
    const [sender, timestamp, isResponse] = await whisperVaultContract.getMessageMetadata(
      taskArguments.user,
      index
    );

    console.log(`Message #${index} metadata:`);
    console.log(`  Sender: ${sender}`);
    console.log(`  Timestamp: ${new Date(Number(timestamp) * 1000).toISOString()}`);
    console.log(`  Is Response: ${isResponse}`);
  });
