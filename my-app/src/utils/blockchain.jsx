// src/utils/blockchain.js

/**
 * Mock blockchain interaction for demonstration
 * In production, this would interact with actual smart contracts
 */

// Mock contract ABI for demonstration
export const mockContractABI = [
    "function verifyProof(bytes proof, bytes32 nullifier, bytes32 credentialRoot) returns (bool)",
    "function registerKYC(address user, uint256 expiryDate, bytes32 credentialRoot)",
    "function hasValidKYC(address user) view returns (bool)",
    "event ProofVerified(address indexed user, bytes32 nullifier)",
    "event KYCVerified(address indexed user, bytes32 indexed credentialRoot)"
];

/**
 * Initialize a mock contract instance
 */
export const getMockContract = () => {
    return {
        address: '0x' + '1'.repeat(40), // Mock address
        async verifyProof(proof, nullifier, credentialRoot) {
            console.log('Mock contract: verifyProof called', { 
                proofLength: proof.length,
                nullifier,
                credentialRoot 
            });
            
            // Simulate blockchain delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Always return true for demo
            return {
                wait: async () => ({
                    hash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: Math.floor(Math.random() * 1000000),
                    confirmations: 1
                })
            };
        },
        
        async registerKYC(user, expiryDate, credentialRoot) {
            console.log('Mock contract: registerKYC called', { 
                user,
                expiryDate,
                credentialRoot 
            });
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            return {
                wait: async () => ({
                    hash: '0x' + Math.random().toString(16).substr(2, 64),
                    blockNumber: Math.floor(Math.random() * 1000000),
                    confirmations: 1
                })
            };
        },
        
        async hasValidKYC(user) {
            console.log('Mock contract: hasValidKYC called', { user });
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Return true for demo
            return true;
        }
    };
};

/**
 * Connect to MetaMask wallet
 */
export const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
        try {
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });
            
            const provider = new ethers.providers.Web3Provider(window.ethereum);
            const signer = provider.getSigner();
            const network = await provider.getNetwork();
            
            return {
                address: accounts[0],
                signer,
                provider,
                network: network.name,
                chainId: network.chainId
            };
        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    } else {
        throw new Error('MetaMask not installed');
    }
};

/**
 * Switch to Base network
 */
export const switchToBaseNetwork = async () => {
    if (window.ethereum) {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0x2105' }], // Base Mainnet
            });
            return true;
        } catch (switchError) {
            // If the network hasn't been added to MetaMask
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [
                            {
                                chainId: '0x2105',
                                chainName: 'Base',
                                nativeCurrency: {
                                    name: 'Ether',
                                    symbol: 'ETH',
                                    decimals: 18
                                },
                                rpcUrls: ['https://mainnet.base.org'],
                                blockExplorerUrls: ['https://basescan.org']
                            }
                        ]
                    });
                    return true;
                } catch (addError) {
                    console.error('Failed to add Base network:', addError);
                    return false;
                }
            }
            console.error('Failed to switch to Base network:', switchError);
            return false;
        }
    }
    return false;
};

/**
 * Get transaction history for a user
 */
export const getTransactionHistory = async (address) => {
    // Mock transaction history for demo
    return [
        {
            hash: '0x' + Math.random().toString(16).substr(2, 64),
            type: 'KYC Registration',
            timestamp: Date.now() - 86400000, // 1 day ago
            status: 'confirmed',
            blockNumber: Math.floor(Math.random() * 1000000)
        },
        {
            hash: '0x' + Math.random().toString(16).substr(2, 64),
            type: 'Proof Verification',
            timestamp: Date.now() - 172800000, // 2 days ago
            status: 'confirmed',
            blockNumber: Math.floor(Math.random() * 1000000)
        }
    ];
};

/**
 * Format Ethereum address for display
 */
export const formatAddress = (address) => {
    if (!address) return '';
    return `${address.substring(0, 6)}...${address.substring(38)}`;
};

/**
 * Format amount in ETH
 */
export const formatETH = (amount) => {
    return parseFloat(amount).toFixed(4) + ' ETH';
};

export default {
    getMockContract,
    connectWallet,
    switchToBaseNetwork,
    getTransactionHistory,
    formatAddress,
    formatETH
};