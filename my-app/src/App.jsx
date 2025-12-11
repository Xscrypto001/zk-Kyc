import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import KYCForm from './components/KYCForm';
import ProofGenerator from './components/ProofGenerator';
import VerifierDashboard from './components/VerifierDashboard';
import './style.css';

function App() {
    const [userAddress, setUserAddress] = useState('');
    const [contract, setContract] = useState(null);
    const [network, setNetwork] = useState('Not Connected');
    const [activeTab, setActiveTab] = useState('kyc');
    const [credential, setCredential] = useState(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState('');

    // Check if MetaMask is installed
    const checkMetaMask = () => {
        if (typeof window.ethereum === 'undefined') {
            setError('MetaMask is not installed. Please install MetaMask to use this platform.');
            return false;
        }
        return true;
    };

    // Check if already connected
    useEffect(() => {
        const checkConnection = async () => {
            if (checkMetaMask() && window.ethereum.selectedAddress) {
                try {
                    await connectWallet();
                } catch (err) {
                    console.log('Auto-connect failed:', err);
                }
            }
        };
        checkConnection();
    }, []);

    const connectWallet = async () => {
        setError('');
        setIsConnecting(true);

        try {
            // Check if MetaMask is installed
            if (!checkMetaMask()) {
                return;
            }

            // Request account access
            const accounts = await window.ethereum.request({ 
                method: 'eth_requestAccounts' 
            });

            if (!accounts || accounts.length === 0) {
                throw new Error('No accounts found. Please unlock MetaMask.');
            }

            const address = accounts[0];
            setUserAddress(address);
            
            // Initialize provider with better error handling
            let provider;
            try {
                provider = new ethers.providers.Web3Provider(window.ethereum);
            } catch (providerError) {
                console.error('Provider initialization error:', providerError);
                // Fallback to default provider
                provider = ethers.getDefaultProvider();
                setNetwork('Mainnet (Read-only)');
            }
            
            // Get network info
            try {
                const networkInfo = await provider.getNetwork();
                setNetwork(networkInfo.name === 'unknown' ? 'Base' : networkInfo.name);
            } catch (networkError) {
                console.error('Network error:', networkError);
                setNetwork('Unknown');
            }

            // Mock contract for demo
            const mockContract = {
                address: '0x' + '1'.repeat(40),
                verifyProof: async (proof, nullifier, credentialRoot) => { 
                    console.log('Verifying proof:', { nullifier });
                    return { 
                        wait: async () => ({
                            hash: '0x' + Math.random().toString(16).substr(2, 64),
                            blockNumber: Math.floor(Math.random() * 1000000),
                            confirmations: 1
                        })
                    }; 
                },
                registerKYC: async (user, expiryDate, credentialRoot) => { 
                    console.log('Registering KYC:', { user });
                    return { 
                        wait: async () => ({
                            hash: '0x' + Math.random().toString(16).substr(2, 64),
                            blockNumber: Math.floor(Math.random() * 1000000),
                            confirmations: 1
                        })
                    }; 
                },
                hasValidKYC: async (user) => { 
                    console.log('Checking KYC for:', user);
                    return true; 
                }
            };
            setContract(mockContract);
            
            // Mock credential for demo
            setCredential({
                id: 'cred_' + Date.now(),
                userAddress: address,
                issuedAt: Date.now(),
                expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
                verified: true
            });

            // Listen for account changes
            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    // User disconnected
                    setUserAddress('');
                    setContract(null);
                    setCredential(null);
                    setNetwork('Not Connected');
                } else {
                    setUserAddress(accounts[0]);
                }
            });

            // Listen for chain changes
            window.ethereum.on('chainChanged', () => {
                window.location.reload();
            });

        } catch (error) {
            console.error('Wallet connection failed:', error);
            
            // User-friendly error messages
            if (error.code === 4001) {
                setError('Connection rejected by user. Please approve the connection request.');
            } else if (error.code === -32002) {
                setError('MetaMask connection already pending. Please check your MetaMask extension.');
            } else {
                setError(`Failed to connect wallet: ${error.message || 'Unknown error'}`);
            }
            
            // Fallback to mock mode for demo
            setUserAddress('0xDemoUser1234567890');
            setNetwork('Base (Demo Mode)');
            setContract({
                verifyProof: async () => ({ wait: async () => {} }),
                registerKYC: async () => ({ wait: async () => {} }),
                hasValidKYC: async () => true
            });
            setCredential({
                id: 'demo_cred_' + Date.now(),
                userAddress: '0xDemoUser1234567890',
                issuedAt: Date.now(),
                expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
                verified: true
            });
        } finally {
            setIsConnecting(false);
        }
    };

    // Demo mode for testing without MetaMask
    const connectDemoMode = () => {
        setUserAddress('0xDemoUser1234567890abcdef1234567890abcdef12');
        setNetwork('Base (Demo Mode)');
        setContract({
            verifyProof: async () => ({ 
                wait: async () => ({
                    hash: '0xdemo' + Math.random().toString(16).substr(2, 60),
                    blockNumber: 1234567,
                    confirmations: 1
                })
            }),
            registerKYC: async () => ({ 
                wait: async () => ({
                    hash: '0xdemo' + Math.random().toString(16).substr(2, 60),
                    blockNumber: 1234567,
                    confirmations: 1
                })
            }),
            hasValidKYC: async () => true
        });
        setCredential({
            id: 'demo_cred_' + Date.now(),
            userAddress: '0xDemoUser1234567890abcdef1234567890abcdef12',
            issuedAt: Date.now(),
            expiryDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
            verified: true
        });
        setError('');
    };

    return (
        <div className="app-container">
            <header>
                <h1>zkKYC Platform</h1>
                <p>Privacy-preserving identity verification on Base Network using zero-knowledge proofs</p>
                
                {error && (
                    <div className="error-alert">
                        <i className="fas fa-exclamation-triangle"></i>
                        <span>{error}</span>
                        <button onClick={() => setError('')} className="close-error">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                )}
                
                {!userAddress ? (
                    <div className="connect-wallet-section">
                        <button 
                            onClick={connectWallet} 
                            className="connect-btn"
                            disabled={isConnecting}
                        >
                            {isConnecting ? (
                                <>
                                    <i className="fas fa-spinner fa-spin"></i> Connecting...
                                </>
                            ) : (
                                <>
                                    <i className="fas fa-wallet"></i> Connect Wallet
                                </>
                            )}
                        </button>
                        
                        <div className="demo-mode-section">
                            <p className="demo-text">Don't have MetaMask? Try demo mode:</p>
                            <button onClick={connectDemoMode} className="demo-btn">
                                <i className="fas fa-vial"></i> Try Demo Mode
                            </button>
                        </div>
                        
                        <div className="wallet-instructions">
                            <h4><i className="fas fa-info-circle"></i> Setup Instructions:</h4>
                            <ol>
                                <li>Install <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">MetaMask</a> browser extension</li>
                                <li>Add Base Network to MetaMask (Chain ID: 8453)</li>
                                <li>Click "Connect Wallet" above</li>
                            </ol>
                        </div>
                    </div>
                ) : (
                    <div className="user-info">
                        <div className="wallet-address">
                            <i className="fas fa-user-circle"></i>
                            {userAddress.substring(0, 6)}...{userAddress.substring(38)}
                            {userAddress.startsWith('0xDemo') && (
                                <span className="demo-badge">Demo</span>
                            )}
                        </div>
                        <div className="network-badge">
                            <i className="fas fa-network-wired"></i> {network}
                        </div>
                        <button 
                            className="disconnect-btn"
                            onClick={() => {
                                setUserAddress('');
                                setContract(null);
                                setCredential(null);
                                setNetwork('Not Connected');
                                setError('');
                            }}
                        >
                            <i className="fas fa-sign-out-alt"></i> Disconnect
                        </button>
                    </div>
                )}
            </header>

            <nav className="main-nav">
                <button 
                    className={activeTab === 'kyc' ? 'active' : ''}
                    onClick={() => setActiveTab('kyc')}
                >
                    <i className="fas fa-id-card"></i> KYC Verification
                </button>
                <button 
                    className={activeTab === 'proofs' ? 'active' : ''}
                    onClick={() => setActiveTab('proofs')}
                >
                    <i className="fas fa-key"></i> Proof Generator
                </button>
                <button 
                    className={activeTab === 'verifier' ? 'active' : ''}
                    onClick={() => setActiveTab('verifier')}
                >
                    <i className="fas fa-user-check"></i> Verifier Dashboard
                </button>
            </nav>

            <main>
                {!userAddress ? (
                    <div className="welcome-section">
                        <div className="welcome-card">
                            <h2><i className="fas fa-shield-alt"></i> Welcome to zkKYC Platform</h2>
                            <p>Connect your wallet to start using privacy-preserving KYC on Base Network.</p>
                            
                            <div className="setup-steps">
                                <div className="step">
                                    <div className="step-number">1</div>
                                    <div className="step-content">
                                        <h4>Install MetaMask</h4>
                                        <p>Get the browser extension from <a href="https://metamask.io/" target="_blank" rel="noopener noreferrer">metamask.io</a></p>
                                    </div>
                                </div>
                                <div className="step">
                                    <div className="step-number">2</div>
                                    <div className="step-content">
                                        <h4>Add Base Network</h4>
                                        <p>Network: Base Mainnet | RPC: https://mainnet.base.org | Chain ID: 8453</p>
                                    </div>
                                </div>
                                <div className="step">
                                    <div className="step-number">3</div>
                                    <div className="step-content">
                                        <h4>Connect & Start</h4>
                                        <p>Click "Connect Wallet" to begin your privacy-preserving KYC journey</p>
                                    </div>
                                </div>
                            </div>
                            
                            <button onClick={connectWallet} className="cta-btn" disabled={isConnecting}>
                                {isConnecting ? (
                                    <>
                                        <i className="fas fa-spinner fa-spin"></i> Connecting...
                                    </>
                                ) : (
                                    <>
                                        <i className="fas fa-plug"></i> Connect Wallet
                                    </>
                                )}
                            </button>
                            
                            <div className="demo-section">
                                <p className="demo-hint">Just want to explore? Try demo mode without installation:</p>
                                <button onClick={connectDemoMode} className="demo-cta-btn">
                                    <i className="fas fa-play-circle"></i> Launch Demo Mode
                                </button>
                            </div>
                            
                            <div className="features">
                                <div className="feature">
                                    <i className="fas fa-user-secret"></i>
                                    <h3>Privacy First</h3>
                                    <p>Your personal data never leaves your device</p>
                                </div>
                                <div className="feature">
                                    <i className="fas fa-bolt"></i>
                                    <h3>Fast & Cheap</h3>
                                    <p>Built on Base L2 for low-cost transactions</p>
                                </div>
                                <div className="feature">
                                    <i className="fas fa-shield-check"></i>
                                    <h3>Zero-Knowledge</h3>
                                    <p>Prove without revealing personal information</p>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <>
                        {activeTab === 'kyc' && <KYCForm contract={contract} userAddress={userAddress} />}
                        {activeTab === 'proofs' && <ProofGenerator userAddress={userAddress} contract={contract} credential={credential} />}
                        {activeTab === 'verifier' && <VerifierDashboard contract={contract} userAddress={userAddress} />}
                    </>
                )}
            </main>

            <footer>
                <p>zkKYC Platform © 2024 | Built on Base Network | Zero-Knowledge Identity Verification</p>
                <p className="disclaimer">This is a conceptual demonstration. Not audited for production use.</p>
                <div className="footer-links">
                    <a href="#" onClick={(e) => { e.preventDefault(); connectDemoMode(); }}>Demo Mode</a>
                    <a href="#" onClick={(e) => { e.preventDefault(); window.location.reload(); }}>Refresh</a>
                </div>
            </footer>
        </div>
    );
}

export default App;