pragma solidity ^0.8.19;

interface IZkKYC {
    function registerKYC(
        address user,
        uint256 expiryDate,
        bytes32 credentialRoot
    ) external;
    
    function verifyProof(
        bytes calldata proof,
        bytes32 nullifier,
        bytes32 credentialRoot
    ) external returns (bool);
    
    function hasValidKYC(address user) external view returns (bool);
}