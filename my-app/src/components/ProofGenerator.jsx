import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './ProofGenerator.css';

const ProofGenerator = ({ userAddress, contract, credential }) => {
    const [requirements, setRequirements] = useState({
        minAge: 18,
        allowedCountries: ['US', 'GB', 'DE', 'FR', 'JP'],
        requireName: false,
        requireAddress: false,
        expiryDays: 30
    });
    
    const [generating, setGenerating] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [proofs, setProofs] = useState([]);
    const [currentProof, setCurrentProof] = useState(null);
    const [verificationResult, setVerificationResult] = useState(null);
    
    // Load user's proofs
    useEffect(() => {
        if (userAddress) {
            loadUserProofs();
        }
    }, [userAddress]);
    
    const loadUserProofs = async () => {
        try {
            // In production, fetch from backend
            const mockProofs = [
                {
                    id: 'proof_1',
                    nullifier: '0x1234...abcd',
                    requirements: { minAge: 18 },
                    generatedAt: '2024-01-15T10:30:00Z',
                    verified: true,
                    onChain: true
                },
                {
                    id: 'proof_2',
                    nullifier: '0x5678...efgh',
                    requirements: { minAge: 21, country: 'US' },
                    generatedAt: '2024-01-20T14:45:00Z',
                    verified: true,
                    onChain: false
                }
            ];
            setProofs(mockProofs);
        } catch (error) {
            console.error('Failed to load proofs:', error);
        }
    };
    
    const handleRequirementChange = (key, value) => {
        setRequirements(prev => ({
            ...prev,
            [key]: value
        }));
    };
    
    const handleCountryToggle = (country) => {
        setRequirements(prev => {
            const countries = [...prev.allowedCountries];
            const index = countries.indexOf(country);
            
            if (index > -1) {
                countries.splice(index, 1);
            } else {
                countries.push(country);
            }
            
            return {
                ...prev,
                allowedCountries: countries
            };
        });
    };
    
    const generateProof = async () => {
        if (!credential) {
            alert('No credential found. Please complete KYC first.');
            return;
        }
        
        setGenerating(true);
        setVerificationResult(null);
        
        try {
            // Call backend to generate proof
            const response = await fetch('http://localhost:3001/api/generate-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: userAddress,
                    credentialId: credential.id,
                    requirements
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                const proof = {
                    ...data,
                    id: `proof_${Date.now()}`,
                    generatedAt: new Date().toISOString(),
                    requirements
                };
                
                setCurrentProof(proof);
                setProofs(prev => [proof, ...prev]);
                
                // Store proof locally
                localStorage.setItem(`zk_proof_${proof.nullifier}`, JSON.stringify(proof));
                
                alert('Zero-knowledge proof generated successfully!');
            } else {
                throw new Error(data.error || 'Failed to generate proof');
            }
        } catch (error) {
            console.error('Proof generation failed:', error);
            alert(`Proof generation failed: ${error.message}`);
        } finally {
            setGenerating(false);
        }
    };
    
    const verifyProof = async (proofToVerify = currentProof) => {
        if (!proofToVerify) return;
        
        setVerifying(true);
        
        try {
            // Verify proof on backend
            const response = await fetch('http://localhost:3001/api/verify-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    proof: proofToVerify.proof,
                    publicSignals: proofToVerify.publicSignals,
                    nullifier: proofToVerify.nullifier
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Also verify on-chain if contract is available
                if (contract) {
                    try {
                        const tx = await contract.verifyProof(
                            ethers.utils.toUtf8Bytes(JSON.stringify(proofToVerify.proof)),
                            proofToVerify.nullifier,
                            proofToVerify.credentialRoot || ethers.constants.HashZero
                        );
                        
                        await tx.wait();
                        data.onChain = true;
                    } catch (onChainError) {
                        console.warn('On-chain verification failed:', onChainError);
                        data.onChain = false;
                    }
                }
                
                setVerificationResult(data);
                
                // Update proof status
                setProofs(prev => prev.map(p => 
                    p.nullifier === proofToVerify.nullifier 
                        ? { ...p, verified: true, onChain: data.onChain }
                        : p
                ));
                
                alert('Proof verified successfully!');
            } else {
                setVerificationResult(data);
                alert(`Proof verification failed: ${data.error}`);
            }
        } catch (error) {
            console.error('Proof verification failed:', error);
            alert(`Proof verification failed: ${error.message}`);
        } finally {
            setVerifying(false);
        }
    };
    
    const exportProof = (proof) => {
        const proofData = {
            ...proof,
            exportedAt: new Date().toISOString(),
            platform: 'zkKYC Platform',
            version: '1.0'
        };
        
        const dataStr = JSON.stringify(proofData, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const exportLink = document.createElement('a');
        exportLink.setAttribute('href', dataUri);
        exportLink.setAttribute('download', `zk_proof_${proof.nullifier.substring(0, 16)}.json`);
        document.body.appendChild(exportLink);
        exportLink.click();
        document.body.removeChild(exportLink);
    };
    
    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            alert('Copied to clipboard!');
        });
    };
    
    return (
        <div className="proof-generator">
            <div className="generator-header">
                <h2><i className="fas fa-key"></i> Zero-Knowledge Proof Generator</h2>
                <p>Generate privacy-preserving proofs from your KYC credential</p>
            </div>
            
            <div className="generator-content">
                {/* Left column: Requirements */}
                <div className="requirements-panel">
                    <h3><i className="fas fa-sliders-h"></i> Proof Requirements</h3>
                    
                    <div className="requirement-group">
                        <label>Minimum Age</label>
                        <div className="age-slider">
                            <input
                                type="range"
                                min="13"
                                max="100"
                                value={requirements.minAge}
                                onChange={(e) => handleRequirementChange('minAge', parseInt(e.target.value))}
                            />
                            <span className="age-value">{requirements.minAge} years</span>
                        </div>
                    </div>
                    
                    <div className="requirement-group">
                        <label>Allowed Countries</label>
                        <div className="country-selector">
                            {['US', 'GB', 'DE', 'FR', 'JP', 'CA', 'AU', 'SG'].map(country => (
                                <button
                                    key={country}
                                    type="button"
                                    className={`country-chip ${requirements.allowedCountries.includes(country) ? 'selected' : ''}`}
                                    onClick={() => handleCountryToggle(country)}
                                >
                                    <span className={`flag-icon flag-icon-${country.toLowerCase()}`}></span>
                                    {country}
                                    {requirements.allowedCountries.includes(country) && (
                                        <i className="fas fa-check"></i>
                                    )}
                                </button>
                            ))}
                        </div>
                        <small>Select countries where this proof is valid</small>
                    </div>
                    
                    <div className="requirement-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={requirements.requireName}
                                onChange={(e) => handleRequirementChange('requireName', e.target.checked)}
                            />
                            <span>Require Name Verification</span>
                        </label>
                        <small>Proof will include name validation</small>
                    </div>
                    
                    <div className="requirement-group">
                        <label className="checkbox-label">
                            <input
                                type="checkbox"
                                checked={requirements.requireAddress}
                                onChange={(e) => handleRequirementChange('requireAddress', e.target.checked)}
                            />
                            <span>Require Address Verification</span>
                        </label>
                        <small>Proof will include address validation</small>
                    </div>
                    
                    <div className="requirement-group">
                        <label>Proof Validity Period</label>
                        <select
                            value={requirements.expiryDays}
                            onChange={(e) => handleRequirementChange('expiryDays', parseInt(e.target.value))}
                        >
                            <option value={1}>1 day</option>
                            <option value={7}>7 days</option>
                            <option value={30}>30 days</option>
                            <option value={90}>90 days</option>
                            <option value={365}>1 year</option>
                            <option value={0}>No expiry</option>
                        </select>
                    </div>
                    
                    <button
                        className="generate-btn"
                        onClick={generateProof}
                        disabled={generating || !credential}
                    >
                        {generating ? (
                            <>
                                <i className="fas fa-spinner fa-spin"></i> Generating Proof...
                            </>
                        ) : (
                            <>
                                <i className="fas fa-magic"></i> Generate ZK Proof
                            </>
                        )}
                    </button>
                    
                    {!credential && (
                        <div className="warning-message">
                            <i className="fas fa-exclamation-triangle"></i>
                            <p>You need to complete KYC verification first to generate proofs.</p>
                        </div>
                    )}
                </div>
                
                {/* Right column: Current Proof */}
                <div className="proof-panel">
                    <h3><i className="fas fa-file-certificate"></i> Current Proof</h3>
                    
                    {currentProof ? (
                        <div className="proof-details">
                            <div className="proof-header">
                                <span className="proof-id">Proof #{currentProof.nullifier.substring(0, 8)}</span>
                                <span className={`proof-status ${currentProof.verified ? 'verified' : 'pending'}`}>
                                    {currentProof.verified ? '✓ Verified' : '⏳ Pending'}
                                </span>
                            </div>
                            
                            <div className="proof-info">
                                <div className="info-row">
                                    <span className="label">Nullifier:</span>
                                    <span className="value">
                                        {currentProof.nullifier.substring(0, 20)}...
                                        <button 
                                            className="copy-btn"
                                            onClick={() => copyToClipboard(currentProof.nullifier)}
                                            title="Copy nullifier"
                                        >
                                            <i className="fas fa-copy"></i>
                                        </button>
                                    </span>
                                </div>
                                
                                <div className="info-row">
                                    <span className="label">Generated:</span>
                                    <span className="value">
                                        {new Date(currentProof.generatedAt).toLocaleString()}
                                    </span>
                                </div>
                                
                                <div className="info-row">
                                    <span className="label">Requirements:</span>
                                    <span className="value">
                                        Age ≥ {currentProof.requirements.minAge}, {currentProof.requirements.allowedCountries.length} countries
                                    </span>
                                </div>
                                
                                <div className="info-row">
                                    <span className="label">Size:</span>
                                    <span className="value">
                                        {JSON.stringify(currentProof.proof).length} bytes
                                    </span>
                                </div>
                            </div>
                            
                            {verificationResult && (
                                <div className={`verification-result ${verificationResult.success ? 'success' : 'error'}`}>
                                    <h4>
                                        <i className={`fas fa-${verificationResult.success ? 'check-circle' : 'times-circle'}`}></i>
                                        Verification Result
                                    </h4>
                                    <p>{verificationResult.success ? 'Proof is valid' : 'Proof is invalid'}</p>
                                    {verificationResult.onChain && (
                                        <p className="on-chain">
                                            <i className="fas fa-link"></i> Verified on Base Network
                                        </p>
                                    )}
                                    {verificationResult.error && (
                                        <p className="error-message">{verificationResult.error}</p>
                                    )}
                                </div>
                            )}
                            
                            <div className="proof-actions">
                                <button
                                    className="action-btn verify"
                                    onClick={() => verifyProof(currentProof)}
                                    disabled={verifying}
                                >
                                    {verifying ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                        <i className="fas fa-check"></i>
                                    )}
                                    Verify Proof
                                </button>
                                
                                <button
                                    className="action-btn export"
                                    onClick={() => exportProof(currentProof)}
                                >
                                    <i className="fas fa-download"></i>
                                    Export
                                </button>
                                
                                <button
                                    className="action-btn share"
                                    onClick={() => alert('Sharing functionality would be implemented here')}
                                >
                                    <i className="fas fa-share"></i>
                                    Share
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="no-proof">
                            <i className="fas fa-key"></i>
                            <p>No proof generated yet. Configure requirements and click "Generate ZK Proof".</p>
                        </div>
                    )}
                    
                    {/* Proof Statistics */}
                    <div className="proof-stats">
                        <h4><i className="fas fa-chart-bar"></i> Proof Statistics</h4>
                        <div className="stats-grid">
                            <div className="stat">
                                <div className="stat-value">{proofs.length}</div>
                                <div className="stat-label">Total Proofs</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">
                                    {proofs.filter(p => p.verified).length}
                                </div>
                                <div className="stat-label">Verified</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">
                                    {proofs.filter(p => p.onChain).length}
                                </div>
                                <div className="stat-label">On-Chain</div>
                            </div>
                            <div className="stat">
                                <div className="stat-value">
                                    {requirements.allowedCountries.length}
                                </div>
                                <div className="stat-label">Countries</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Proof History */}
            <div className="proof-history">
                <h3><i className="fas fa-history"></i> Proof History</h3>
                
                {proofs.length > 0 ? (
                    <div className="history-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>Proof ID</th>
                                    <th>Requirements</th>
                                    <th>Generated</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {proofs.map(proof => (
                                    <tr key={proof.id}>
                                        <td className="proof-id">
                                            {proof.nullifier.substring(0, 16)}...
                                        </td>
                                        <td>
                                            Age ≥ {proof.requirements?.minAge || 18}
                                            {proof.requirements?.allowedCountries && (
                                                <span className="country-count">
                                                    , {proof.requirements.allowedCountries.length} countries
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            {new Date(proof.generatedAt).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <span className={`status-badge ${proof.verified ? 'verified' : 'pending'}`}>
                                                {proof.verified ? (
                                                    <>
                                                        <i className="fas fa-check-circle"></i> Verified
                                                        {proof.onChain && <span className="on-chain-badge">⛓️</span>}
                                                    </>
                                                ) : (
                                                    <>
                                                        <i className="fas fa-clock"></i> Pending
                                                    </>
                                                )}
                                            </span>
                                        </td>
                                        <td className="actions">
                                            <button
                                                className="icon-btn"
                                                onClick={() => setCurrentProof(proof)}
                                                title="Select"
                                            >
                                                <i className="fas fa-eye"></i>
                                            </button>
                                            <button
                                                className="icon-btn"
                                                onClick={() => verifyProof(proof)}
                                                title="Verify"
                                            >
                                                <i className="fas fa-check"></i>
                                            </button>
                                            <button
                                                className="icon-btn"
                                                onClick={() => exportProof(proof)}
                                                title="Export"
                                            >
                                                <i className="fas fa-download"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="no-history">
                        <i className="fas fa-history"></i>
                        <p>No proof history yet. Generate your first proof above.</p>
                    </div>
                )}
            </div>
            
            {/* Information Section */}
            <div className="information-section">
                <div className="info-card">
                    <h4><i className="fas fa-shield-alt"></i> What is a ZK Proof?</h4>
                    <p>A zero-knowledge proof allows you to prove you have valid KYC credentials without revealing any personal information. The proof only confirms that your credentials meet the specified requirements.</p>
                </div>
                
                <div className="info-card">
                    <h4><i className="fas fa-user-secret"></i> Privacy Guaranteed</h4>
                    <ul>
                        <li>Your personal data never leaves your device</li>
                        <li>Proofs cannot be traced back to your identity</li>
                        <li>Each proof uses a unique nullifier to prevent tracking</li>
                        <li>You control exactly what information is proven</li>
                    </ul>
                </div>
                
                <div className="info-card">
                    <h4><i className="fas fa-bolt"></i> Use Cases</h4>
                    <ul>
                        <li>Prove you're over 18 without revealing your age</li>
                        <li>Access country-restricted services without showing passport</li>
                        <li>Verify identity for DeFi without doxxing yourself</li>
                        <li>Comply with regulations while maintaining privacy</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default ProofGenerator;