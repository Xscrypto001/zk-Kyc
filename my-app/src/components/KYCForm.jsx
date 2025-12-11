import React, { useState } from 'react';
import { ethers } from 'ethers';
import { generateProof, generateNullifier } from '../utils/zkProofs';
import './style.css';

const KYCForm = ({ contract, userAddress }) => {
    const [formData, setFormData] = useState({
        fullName: '',
        dob: '',
        country: '',
        documentType: 'passport',
        documentNumber: '',
        documentImage: null
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [proof, setProof] = useState(null);
    const [zkVerified, setZkVerified] = useState(false);
    
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };
    
    const handleFileChange = (e) => {
        setFormData(prev => ({ ...prev, documentImage: e.target.files[0] }));
    };
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            // In production: Send to trusted KYC provider
            // For demo, we'll simulate KYC verification
            const kycProviderResponse = await simulateKYCVerification(formData);
            
            if (kycProviderResponse.verified) {
                // Generate zero-knowledge proof
                const zkProof = await generateZKProof(formData);
                setProof(zkProof);
                
                // Register KYC on-chain (simplified)
                const tx = await contract.registerKYC(
                    userAddress,
                    Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year expiry
                    ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(zkProof)))
                );
                
                await tx.wait();
                alert('KYC submitted successfully! Proof generated.');
            }
        } catch (error) {
            console.error('KYC submission failed:', error);
            alert('KYC submission failed: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const generateZKProof = async (data) => {
        // This would generate actual zk-SNARK proof using circuits
        // For demo, we return a mock proof
        return {
            proof: 'mock-zk-proof-' + Date.now(),
            publicSignals: [
                '0x' + ethers.utils.keccak256(ethers.utils.toUtf8Bytes(data.documentNumber)).slice(2, 10),
                '0x' + ethers.utils.keccak256(ethers.utils.toUtf8Bytes(data.country)).slice(2, 10)
            ],
            nullifier: generateNullifier(data.documentNumber, data.dob)
        };
    };
    
    const simulateKYCVerification = async (data) => {
        // Simulate KYC verification by a trusted provider
        return new Promise(resolve => {
            setTimeout(() => {
                resolve({
                    verified: true,
                    timestamp: Date.now(),
                    provider: 'TrustedKYCProvider'
                });
            }, 2000);
        });
    };
    
    const verifyProofOnChain = async () => {
        if (!proof) return;
        
        try {
            const tx = await contract.verifyProof(
                ethers.utils.toUtf8Bytes(proof.proof),
                proof.nullifier,
                ethers.utils.keccak256(ethers.utils.toUtf8Bytes(JSON.stringify(proof)))
            );
            
            await tx.wait();
            setZkVerified(true);
            alert('ZK Proof verified on-chain!');
        } catch (error) {
            console.error('Proof verification failed:', error);
        }
    };
    
    return (
        <div className="kyc-form-container">
            <h2>Zero-Knowledge KYC Verification</h2>
            <p className="subtitle">Your personal data remains private. Only cryptographic proofs are stored on-chain.</p>
            
            <form onSubmit={handleSubmit} className="kyc-form">
                <div className="form-group">
                    <label>Full Name</label>
                    <input
                        type="text"
                        name="fullName"
                        value={formData.fullName}
                        onChange={handleInputChange}
                        required
                    />
                </div>
                
                <div className="form-row">
                    <div className="form-group">
                        <label>Date of Birth</label>
                        <input
                            type="date"
                            name="dob"
                            value={formData.dob}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                    
                    <div className="form-group">
                        <label>Country</label>
                        <select
                            name="country"
                            value={formData.country}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select Country</option>
                            <option value="US">United States</option>
                            <option value="GB">United Kingdom</option>
                            <option value="DE">Germany</option>
                            <option value="FR">France</option>
                            <option value="JP">Japan</option>
                        </select>
                    </div>
                </div>
                
                <div className="form-row">
                    <div className="form-group">
                        <label>Document Type</label>
                        <select
                            name="documentType"
                            value={formData.documentType}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="passport">Passport</option>
                            <option value="id_card">National ID Card</option>
                            <option value="drivers_license">Driver's License</option>
                        </select>
                    </div>
                    
                    <div className="form-group">
                        <label>Document Number</label>
                        <input
                            type="text"
                            name="documentNumber"
                            value={formData.documentNumber}
                            onChange={handleInputChange}
                            required
                        />
                    </div>
                </div>
                
                <div className="form-group">
                    <label>Document Image</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileChange}
                        required
                    />
                    <small>Upload a clear image of your document</small>
                </div>
                
                <div className="privacy-notice">
                    <h3>🔒 Privacy Guarantee</h3>
                    <ul>
                        <li>Your personal data is never stored on-chain</li>
                        <li>Only cryptographic proofs are publicly visible</li>
                        <li>Zero-knowledge proofs verify without revealing details</li>
                        <li>You control when to generate and use proofs</li>
                    </ul>
                </div>
                
                <button 
                    type="submit" 
                    className="submit-btn"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? 'Processing...' : 'Submit KYC (Privacy-Preserving)'}
                </button>
            </form>
            
            {proof && (
                <div className="proof-section">
                    <h3>Generated Zero-Knowledge Proof</h3>
                    <div className="proof-details">
                        <p><strong>Nullifier:</strong> {proof.nullifier.substring(0, 20)}...</p>
                        <p><strong>Public Signals:</strong> {proof.publicSignals.length} signals</p>
                        <p><strong>Status:</strong> {zkVerified ? '✅ Verified on-chain' : '⚠️ Not yet verified'}</p>
                    </div>
                    
                    {!zkVerified && (
                        <button onClick={verifyProofOnChain} className="verify-btn">
                            Verify Proof on Base Network
                        </button>
                    )}
                    
                    <div className="info-box">
                        <h4>How This Works:</h4>
                        <ol>
                            <li>Your data is verified off-chain by a trusted provider</li>
                            <li>A zk-SNARK proof is generated locally in your browser</li>
                            <li>Only the proof (not your data) is sent to the blockchain</li>
                            <li>Services can verify your KYC status without seeing your details</li>
                        </ol>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KYCForm;