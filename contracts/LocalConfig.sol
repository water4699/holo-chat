// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE} from "@fhevm/solidity/lib/FHE.sol";
import {CoprocessorConfig} from "@fhevm/solidity/lib/Impl.sol";

/**
 * @title LocalConfig
 * @notice Configuration for local Hardhat network with mock FHE contracts
 */
contract LocalConfig {
    constructor() {
        CoprocessorConfig memory config = CoprocessorConfig({
            ACLAddress: 0x50157CFfD6bBFA2DECe204a89ec419c23ef5755D,
            CoprocessorAddress: 0xCD3ab3bd6bcc0c0bf3E27912a92043e817B1cf69,
            DecryptionOracleAddress: 0xa02Cda4Ca3a71D7C46997716F4283aa851C28812,
            KMSVerifierAddress: 0x1364cBBf2cDF5032C47d8226a6f6FBD2AFCDacAC
        });
        FHE.setCoprocessor(config);
    }
}
