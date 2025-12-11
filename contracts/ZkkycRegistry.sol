
pragma solidity ^0.8.19;

import "./interfaces/IZkKYC.sol";

contract ZkKYCRegistry is IZkKYC {
    // Struct for KYC status without revealing personal data
    struct KYCStatus {
        address userAddress;
        uint256 verifiedAt;
        uint256 expiryDate;
        bytes32 credentialRoot;
        bool isActive;
    }
    
    // Trusted KYC Issuers
    mapping(address => bool) public trustedIssuers;
    
    // User address to KYC status mapping
    mapping(address => KYCStatus) public kycStatus;
    
    // Nullifier set to prevent double spending of proofs
    mapping(bytes32 => bool) public nullifiers;
    
    // Events
    event KYCVerified(address indexed user, bytes32 indexed credentialRoot);
    event ProofVerified(address indexed user, bytes32 nullifier);
    event IssuerAdded(address indexed issuer);
    event IssuerRemoved(address indexed issuer);
    
    // Owner/Admin
    address public admin;
    
    constructor() {
        admin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    modifier onlyTrustedIssuer() {
        require(trustedIssuers[msg.sender], "Not trusted issuer");
        _;
    }
    
    /**
     * @dev Add a trusted KYC issuer
     */
    function addTrustedIssuer(address issuer) external onlyAdmin {
        trustedIssuers[issuer] = true;
        emit IssuerAdded(issuer);
    }
    
    /**
     * @dev Remove a trusted KYC issuer
     */
    function removeTrustedIssuer(address issuer) external onlyAdmin {
        trustedIssuers[issuer] = false;
        emit IssuerRemoved(issuer);
    }
    
    /**
     * @dev Register KYC verification (called by trusted issuers)
     */
    function registerKYC(
        address user,
        uint256 expiryDate,
        bytes32 credentialRoot
    ) external onlyTrustedIssuer {
        kycStatus[user] = KYCStatus({
            userAddress: user,
            verifiedAt: block.timestamp,
            expiryDate: expiryDate,
            credentialRoot: credentialRoot,
            isActive: true
        });
        
        emit KYCVerified(user, credentialRoot);
    }
    
    /**
     * @dev Verify a zkProof of KYC without revealing identity
     */
    function verifyProof(
        bytes calldata proof,
        bytes32 nullifier,
        bytes32 credentialRoot
    ) external returns (bool) {
        // Prevent proof reuse
        require(!nullifiers[nullifier], "Proof already used");
        
        // Verify the zkProof (this would call a verifier contract)
        // For now, we'll use a simplified check
        require(verifyZKProof(proof, nullifier, credentialRoot), "Invalid proof");
        
        // Mark nullifier as used
        nullifiers[nullifier] = true;
        
        emit ProofVerified(msg.sender, nullifier);
        return true;
    }
    
    /**
     * @dev Check if a user has valid KYC
     */
    function hasValidKYC(address user) external view returns (bool) {
        KYCStatus memory status = kycStatus[user];
        return status.isActive && status.expiryDate > block.timestamp;
    }
    
    /**
     * @dev Internal function to verify zkProof (would integrate with verifier contract)
     */
    function verifyZKProof(
        bytes calldata proof,
        bytes32 nullifier,
        bytes32 credentialRoot
    ) internal pure returns (bool) {
        // In production, this would call a verifier contract
        // that checks the zk-SNARK/STARK proof
        // This is a placeholder
        return proof.length > 0 && nullifier != bytes32(0) && credentialRoot != bytes32(0);
    }
}
