import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  // Deploy WhisperVault - encrypted messaging vault
  const deployedWhisperVault = await deploy("WhisperVault", {
    from: deployer,
    log: true,
  });

  console.log(`WhisperVault contract: `, deployedWhisperVault.address);
};
export default func;
func.id = "deploy_whisperVault"; // id required to prevent reexecution
func.tags = ["WhisperVault"];
