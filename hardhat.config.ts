import "@fhevm/hardhat-plugin";
import "@nomicfoundation/hardhat-chai-matchers";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "@typechain/hardhat";
import "hardhat-deploy";
import "hardhat-gas-reporter";
import type { HardhatUserConfig } from "hardhat/config";
import { parseUnits } from "ethers";
import { vars as _vars } from "hardhat/config";
import "dotenv/config";
import "solidity-coverage";

import "./tasks/accounts";
import "./tasks/FHECounter";
import "./tasks/WhisperVault";

// Run 'npx hardhat vars setup' to see the list of variables that need to be set

// Provide a safe fallback for Hardhat <2.22 where `vars` is not available
const vars = (_vars as any) ?? { get: (_name: string, fallback = "") => fallback };

// Prefer environment variables first; fallback to hardhat vars when useful
const MNEMONIC: string = vars.get("MNEMONIC", "test test test test test test test test test test test junk");
const INFURA_API_KEY: string = process.env.INFURA_API_KEY ?? vars.get("INFURA_API_KEY", "");
const SEPOLIA_RPC_URL: string =
  process.env.SEPOLIA_RPC_URL ?? (INFURA_API_KEY ? `https://sepolia.infura.io/v3/${INFURA_API_KEY}` : "https://rpc.sepolia.org");
const ETHERSCAN_API_KEY: string = process.env.ETHERSCAN_API_KEY ?? vars.get("ETHERSCAN_API_KEY", "");
const RAW_PRIVATE_KEY: string | undefined = process.env.PRIVATE_KEY || process.env.SEPOLIA_PRIVATE_KEY || undefined;
const PRIVATE_KEY: string | undefined = RAW_PRIVATE_KEY
  ? RAW_PRIVATE_KEY.startsWith("0x")
    ? RAW_PRIVATE_KEY
    : `0x${RAW_PRIVATE_KEY}`
  : undefined;
const RAW_LOCAL_PRIVATE_KEY: string | undefined = process.env.LOCAL_PRIVATE_KEY || undefined;
const LOCAL_PRIVATE_KEY: string | undefined = RAW_LOCAL_PRIVATE_KEY
  ? RAW_LOCAL_PRIVATE_KEY.startsWith("0x")
    ? RAW_LOCAL_PRIVATE_KEY
    : `0x${RAW_LOCAL_PRIVATE_KEY}`
  : undefined;

// Optional EIP-1559 gas overrides for live networks (in gwei)
const MAX_FEE_PER_GAS_GWEI = process.env.MAX_FEE_PER_GAS_GWEI;
const MAX_PRIORITY_FEE_PER_GAS_GWEI = process.env.MAX_PRIORITY_FEE_PER_GAS_GWEI;
const maxFeePerGas = MAX_FEE_PER_GAS_GWEI
  ? parseUnits(String(MAX_FEE_PER_GAS_GWEI), "gwei")
  : undefined;
const maxPriorityFeePerGas = MAX_PRIORITY_FEE_PER_GAS_GWEI
  ? parseUnits(String(MAX_PRIORITY_FEE_PER_GAS_GWEI), "gwei")
  : undefined;

const config: HardhatUserConfig = {
  defaultNetwork: "hardhat",
  namedAccounts: {
    deployer: 0,
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
    },
  },
  gasReporter: {
    currency: "USD",
    enabled: process.env.REPORT_GAS ? true : false,
    excludeContracts: [],
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic: MNEMONIC,
      },
      hardfork: "cancun",
      chainId: 31337,
    },
    localhost: {
      url: process.env.LOCAL_RPC_URL || "http://127.0.0.1:8545",
      accounts: LOCAL_PRIVATE_KEY ? [LOCAL_PRIVATE_KEY] : undefined,
      chainId: 31337,
    },
    anvil: {
      accounts: {
        mnemonic: MNEMONIC,
        path: "m/44'/60'/0'/0/",
        count: 10,
      },
      chainId: 31337,
      url: "http://localhost:8545",
    },
    sepolia: {
      accounts: PRIVATE_KEY
        ? [PRIVATE_KEY]
        : {
            mnemonic: MNEMONIC,
            path: "m/44'/60'/0'/0/",
            count: 10,
          },
      chainId: 11155111,
      url: SEPOLIA_RPC_URL,
      timeout: 120000,
      // Allow explicit EIP-1559 fees to avoid underpriced/pending tx loops
      ...(maxFeePerGas ? { maxFeePerGas } : {}),
      ...(maxPriorityFeePerGas ? { maxPriorityFeePerGas } : {}),
    },
  },
  paths: {
    artifacts: "./artifacts",
    cache: "./cache",
    sources: "./contracts",
    tests: "./test",
  },
  solidity: {
    version: "0.8.27",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/hardhat-template/issues/31
        bytecodeHash: "none",
      },
      // Disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
      evmVersion: "cancun",
    },
  },
  typechain: {
    outDir: "types",
    target: "ethers-v6",
  },
};

export default config;
