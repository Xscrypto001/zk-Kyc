import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import KYCForm from './components/KYCForm';
import ProofGenerator from './components/ProofGenerator';
import VerifierDashboard from './components/VerifierDashboard';
import './style.css';

function App() {
    const [userAddress, setUserAddress] = useState('');
    const [contract, setContract] = useState(null);
    const [network, setNetwork] = useState('Base');
    const [activeTab, setActiveTab] = useState('kyc');
    const [credential, setCredential] = useState(null);

    const connectWallet = async () => {
        if (window.ethereum) {
            try {
                await window.ethereum.request({ method: 'eth_requestAccounts' });
                const provider = new ethers.providers.Web3Provider(window.ethereum);
                const signer = provider.getSigner();
                const address = await signer.getAddress();
                setUserAddress(address);
                
                const network = await provider.getNetwork();
                setNetwork(network.name === 'unknown' ? 'Base' : network.name);
                
                // Mock contract for demo
                const mockContract = {
                    verifyProof: async () => ({ wait: async () => {} }),
                    registerKYC: async () => ({ wait: async () => {} }),
                    hasValidKYC: async () => true
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
                
            } catch (error) {
                console.error('Wallet connection failed:', error);
                alert('Failed to connect wallet: ' + error.message);
            }
        } else {
            alert('Please install MetaMask!');
        }
    };

    return (
        <div className="app-container">
            <header>
                <h1>zkKYC Platform</h1>
                <p>Privacy-preserving identity verification on Base Network using zero-knowledge proofs</p>
                
                {!userAddress ? (
                    <div className="connect-wallet-section">
                        <button onClick={connectWallet} className="connect-btn">
                            <i className="fas fa-wallet"></i> Connect Wallet to Base
                        </button>
                    </div>
                ) : (
                    <div className="user-info">
                        <div className="wallet-address">
                            <i className="fas fa-user-circle"></i>
                            {userAddress.substring(0, 6)}...{userAddress.substring(38)}
                        </div>
                        <div className="network-badge">
                            <i className="fas fa-network-wired"></i> {network}
                        </div>
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
                            <button onClick={connectWallet} className="cta-btn">
                                <i className="fas fa-plug"></i> Connect Wallet
                            </button>
                            
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
            </footer>
        </div>
    );
}

export default App;