import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import '../style.css';

const VerifierDashboard = ({ contract, userAddress }) => {
    const [verifications, setVerifications] = useState([]);
    const [pendingRequests, setPendingRequests] = useState([]);
    const [verificationSettings, setVerificationSettings] = useState({
        minAge: 18,
        requiredCountries: ['US', 'GB'],
        maxProofAge: 30, // days
        autoVerify: false,
        requireOnChain: true,
        feeAmount: 0.01 // ETH
    });
    
    const [verifyingProof, setVerifyingProof] = useState(null);
    const [verificationStats, setVerificationStats] = useState({
        totalVerified: 0,
        todayVerified: 0,
        rejected: 0,
        pending: 0,
        revenue: 0
    });
    
    const [batchVerification, setBatchVerification] = useState({
        enabled: false,
        proofs: [],
        results: []
    });
    
    // Load verification history
    useEffect(() => {
        if (userAddress) {
            loadVerificationHistory();
            loadPendingRequests();
            loadStats();
            
            // Listen for new verification requests (in production)
            // setupEventListeners();
        }
    }, [userAddress]);
    
    const loadVerificationHistory = async () => {
        try {
            // In production, fetch from backend/contract
            const mockVerifications = [
                {
                    id: 'ver_1',
                    proofId: '0x1234...abcd',
                    user: '0xabc...123',
                    timestamp: '2024-01-20T10:30:00Z',
                    status: 'verified',
                    requirements: { minAge: 18 },
                    feePaid: 0.01,
                    onChain: true
                },
                {
                    id: 'ver_2',
                    proofId: '0x5678...efgh',
                    user: '0xdef...456',
                    timestamp: '2024-01-19T14:45:00Z',
                    status: 'rejected',
                    requirements: { minAge: 21 },
                    reason: 'Age requirement not met',
                    feePaid: 0
                }
            ];
            setVerifications(mockVerifications);
        } catch (error) {
            console.error('Failed to load verification history:', error);
        }
    };
    
    const loadPendingRequests = async () => {
        try {
            // In production, fetch from backend/contract
            const mockPending = [
                {
                    id: 'req_1',
                    proofId: '0x9876...5432',
                    user: '0x123...789',
                    submitted: '2024-01-21T09:15:00Z',
                    requirements: { minAge: 18, country: 'US' },
                    proofData: { /* proof data */ }
                },
                {
                    id: 'req_2',
                    proofId: '0xabcd...ef01',
                    user: '0x456...abc',
                    submitted: '2024-01-21T10:30:00Z',
                    requirements: { minAge: 21 },
                    proofData: { /* proof data */ }
                }
            ];
            setPendingRequests(mockPending);
        } catch (error) {
            console.error('Failed to load pending requests:', error);
        }
    };
    
    const loadStats = async () => {
        try {
            // In production, calculate from data
            setVerificationStats({
                totalVerified: 1247,
                todayVerified: 23,
                rejected: 45,
                pending: pendingRequests.length,
                revenue: 12.47
            });
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    };
    
    const handleSettingChange = (key, value) => {
        setVerificationSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };
    
    const verifyProof = async (proofData, requestId = null) => {
        setVerifyingProof(proofData.proofId);
        
        try {
            // Send verification request to backend
            const response = await fetch('http://localhost:3001/api/verify-proof', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    proof: proofData.proofData,
                    publicSignals: proofData.publicSignals,
                    nullifier: proofData.proofId
                })
            });
            
            const result = await response.json();
            
            // Check against our requirements
            const meetsRequirements = checkRequirements(proofData.requirements);
            
            // Verify on-chain if required
            let onChainValid = true;
            if (verificationSettings.requireOnChain && contract) {
                try {
                    const tx = await contract.verifyProof(
                        ethers.utils.toUtf8Bytes(JSON.stringify(proofData.proofData)),
                        proofData.proofId,
                        ethers.constants.HashZero // In production, use actual credential root
                    );
                    
                    await tx.wait();
                    onChainValid = true;
                } catch (error) {
                    console.error('On-chain verification failed:', error);
                    onChainValid = false;
                }
            }
            
            const verificationResult = {
                id: `ver_${Date.now()}`,
                proofId: proofData.proofId,
                user: proofData.user,
                timestamp: new Date().toISOString(),
                status: result.success && meetsRequirements && onChainValid ? 'verified' : 'rejected',
                requirements: proofData.requirements,
                meetsRequirements,
                onChainValid,
                zkValid: result.success,
                reason: !meetsRequirements ? 'Does not meet requirements' : 
                       !onChainValid ? 'On-chain verification failed' :
                       !result.success ? 'ZK proof invalid' : null,
                feePaid: verificationSettings.feeAmount
            };
            
            // Add to history
            setVerifications(prev => [verificationResult, ...prev]);
            
            // Remove from pending if it was a request
            if (requestId) {
                setPendingRequests(prev => prev.filter(req => req.id !== requestId));
            }
            
            // Update stats
            loadStats();
            
            alert(`Verification ${verificationResult.status === 'verified' ? 'successful' : 'failed'}`);
            
        } catch (error) {
            console.error('Verification failed:', error);
            alert(`Verification failed: ${error.message}`);
        } finally {
            setVerifyingProof(null);
        }
    };
    
    const checkRequirements = (proofRequirements) => {
        // Check if proof meets our requirements
        if (proofRequirements.minAge < verificationSettings.minAge) {
            return false;
        }
        
        if (verificationSettings.requiredCountries.length > 0) {
            const proofCountries = proofRequirements.allowedCountries || [];
            const hasRequiredCountry = verificationSettings.requiredCountries.some(country => 
                proofCountries.includes(country)
            );
            
            if (!hasRequiredCountry && verificationSettings.requiredCountries.length > 0) {
                return false;
            }
        }
        
        // Check proof age if specified
        if (verificationSettings.maxProofAge > 0) {
            const proofAge = proofRequirements.proofAge || 0;
            if (proofAge > verificationSettings.maxProofAge) {
                return false;
            }
        }
        
        return true;
    };
    
    const batchVerify = async () => {
        if (batchVerification.proofs.length === 0) return;
        
        try {
            const batchResults = [];
            
            for (const proof of batchVerification.proofs) {
                const result = await verifyProofBatch(proof);
                batchResults.push({
                    proofId: proof.proofId,
                    ...result
                });
            }
            
            setBatchVerification(prev => ({
                ...prev,
                results: batchResults
            }));
            
            alert(`Batch verification completed: ${batchResults.filter(r => r.valid).length}/${batchResults.length} valid`);
            
        } catch (error) {
            console.error('Batch verification failed:', error);
            alert('Batch verification failed');
        }
    };
    
    const verifyProofBatch = async (proofData) => {
        // Simplified batch verification
        try {
            const response = await fetch('http://localhost:3001/api/verify-proof', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    proof: proofData.proofData,
                    publicSignals: proofData.publicSignals,
                    nullifier: proofData.proofId
                })
            });
            
            const result = await response.json();
            return {
                valid: result.success,
                error: result.error
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    };
    
    const addProofToBatch = (proofData) => {
        if (!batchVerification.proofs.find(p => p.proofId === proofData.proofId)) {
            setBatchVerification(prev => ({
                ...prev,
                proofs: [...prev.proofs, proofData]
            }));
        }
    };
    
    const removeProofFromBatch = (proofId) => {
        setBatchVerification(prev => ({
            ...prev,
            proofs: prev.proofs.filter(p => p.proofId !== proofId)
        }));
    };
    
    const exportVerificationReport = () => {
        const report = {
            generated: new Date().toISOString(),
            verifier: userAddress,
            settings: verificationSettings,
            stats: verificationStats,
            recentVerifications: verifications.slice(0, 10)
        };
        
        const dataStr = JSON.stringify(report, null, 2);
        const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
        
        const link = document.createElement('a');
        link.setAttribute('href', dataUri);
        link.setAttribute('download', `verification_report_${Date.now()}.json`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const calculateFee = (requirements) => {
        // Simple fee calculation based on requirements
        let fee = verificationSettings.feeAmount;
        
        if (requirements.minAge > 21) fee += 0.005;
        if (requirements.allowedCountries?.length > 3) fee += 0.003;
        
        return fee;
    };
    
    return (
        <div className="verifier-dashboard">
            <div className="dashboard-header">
                <h2><i className="fas fa-user-check"></i> Verifier Dashboard</h2>
                <p>Verify zero-knowledge proofs and manage verification settings</p>
            </div>
            
            {/* Stats Overview */}
            <div className="stats-overview">
                <div className="stat-card">
                    <div className="stat-icon verified">
                        <i className="fas fa-check-circle"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{verificationStats.totalVerified}</h3>
                        <p>Total Verified</p>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon today">
                        <i className="fas fa-calendar-day"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{verificationStats.todayVerified}</h3>
                        <p>Today</p>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon pending">
                        <i className="fas fa-clock"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{verificationStats.pending}</h3>
                        <p>Pending</p>
                    </div>
                </div>
                
                <div className="stat-card">
                    <div className="stat-icon revenue">
                        <i className="fas fa-coins"></i>
                    </div>
                    <div className="stat-content">
                        <h3>{verificationStats.revenue} ETH</h3>
                        <p>Revenue</p>
                    </div>
                </div>
            </div>
            
            <div className="dashboard-content">
                {/* Left column: Settings & Pending Requests */}
                <div className="left-column">
                    {/* Verification Settings */}
                    <div className="settings-card">
                        <h3><i className="fas fa-cog"></i> Verification Settings</h3>
                        
                        <div className="setting-group">
                            <label>Minimum Age</label>
                            <div className="setting-control">
                                <input
                                    type="range"
                                    min="13"
                                    max="100"
                                    value={verificationSettings.minAge}
                                    onChange={(e) => handleSettingChange('minAge', parseInt(e.target.value))}
                                />
                                <span className="setting-value">{verificationSettings.minAge} years</span>
                            </div>
                        </div>
                        
                        <div className="setting-group">
                            <label>Required Countries</label>
                            <div className="countries-select">
                                {['US', 'GB', 'DE', 'FR', 'JP', 'CA', 'AU'].map(country => (
                                    <label key={country} className="country-option">
                                        <input
                                            type="checkbox"
                                            checked={verificationSettings.requiredCountries.includes(country)}
                                            onChange={(e) => {
                                                const countries = [...verificationSettings.requiredCountries];
                                                if (e.target.checked) {
                                                    countries.push(country);
                                                } else {
                                                    const index = countries.indexOf(country);
                                                    if (index > -1) countries.splice(index, 1);
                                                }
                                                handleSettingChange('requiredCountries', countries);
                                            }}
                                        />
                                        <span className="flag-icon"></span>
                                        {country}
                                    </label>
                                ))}
                            </div>
                        </div>
                        
                        <div className="setting-group">
                            <label>Maximum Proof Age (days)</label>
                            <select
                                value={verificationSettings.maxProofAge}
                                onChange={(e) => handleSettingChange('maxProofAge', parseInt(e.target.value))}
                            >
                                <option value={0}>No limit</option>
                                <option value={1}>1 day</option>
                                <option value={7}>7 days</option>
                                <option value={30}>30 days</option>
                                <option value={90}>90 days</option>
                            </select>
                        </div>
                        
                        <div className="setting-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={verificationSettings.autoVerify}
                                    onChange={(e) => handleSettingChange('autoVerify', e.target.checked)}
                                />
                                <span>Auto-verify valid proofs</span>
                            </label>
                        </div>
                        
                        <div className="setting-group">
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={verificationSettings.requireOnChain}
                                    onChange={(e) => handleSettingChange('requireOnChain', e.target.checked)}
                                />
                                <span>Require on-chain verification</span>
                            </label>
                        </div>
                        
                        <div className="setting-group">
                            <label>Verification Fee (ETH)</label>
                            <input
                                type="number"
                                step="0.001"
                                min="0"
                                value={verificationSettings.feeAmount}
                                onChange={(e) => handleSettingChange('feeAmount', parseFloat(e.target.value))}
                            />
                        </div>
                        
                        <button className="save-settings-btn">
                            <i className="fas fa-save"></i> Save Settings
                        </button>
                    </div>
                    
                    {/* Pending Requests */}
                    <div className="pending-requests">
                        <h3><i className="fas fa-inbox"></i> Pending Verification Requests ({pendingRequests.length})</h3>
                        
                        {pendingRequests.length > 0 ? (
                            <div className="requests-list">
                                {pendingRequests.map(request => (
                                    <div key={request.id} className="request-card">
                                        <div className="request-header">
                                            <span className="request-id">#{request.proofId.substring(0, 8)}</span>
                                            <span className="request-time">
                                                {new Date(request.submitted).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        
                                        <div className="request-details">
                                            <p><strong>User:</strong> {request.user.substring(0, 12)}...</p>
                                            <p><strong>Requirements:</strong> Age ≥ {request.requirements.minAge || 18}</p>
                                            <p><strong>Fee:</strong> {calculateFee(request.requirements).toFixed(4)} ETH</p>
                                        </div>
                                        
                                        <div className="request-actions">
                                            <button
                                                className="action-btn verify"
                                                onClick={() => verifyProof(request, request.id)}
                                                disabled={verifyingProof === request.proofId}
                                            >
                                                {verifyingProof === request.proofId ? (
                                                    <i className="fas fa-spinner fa-spin"></i>
                                                ) : (
                                                    <i className="fas fa-check"></i>
                                                )}
                                                Verify
                                            </button>
                                            
                                            <button
                                                className="action-btn reject"
                                                onClick={() => {
                                                    setPendingRequests(prev => prev.filter(req => req.id !== request.id));
                                                    alert('Request rejected');
                                                }}
                                            >
                                                <i className="fas fa-times"></i>
                                                Reject
                                            </button>
                                            
                                            <button
                                                className="action-btn batch"
                                                onClick={() => addProofToBatch(request)}
                                            >
                                                <i className="fas fa-layer-group"></i>
                                                Add to Batch
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="no-requests">
                                <i className="fas fa-check-circle"></i>
                                <p>No pending verification requests</p>
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Right column: Batch Verification & History */}
                <div className="right-column">
                    {/* Batch Verification */}
                    <div className="batch-verification">
                        <h3><i className="fas fa-layer-group"></i> Batch Verification</h3>
                        
                        <div className="batch-controls">
                            <label className="toggle-label">
                                <input
                                    type="checkbox"
                                    checked={batchVerification.enabled}
                                    onChange={(e) => setBatchVerification(prev => ({ ...prev, enabled: e.target.checked }))}
                                />
                                <span>Enable Batch Mode</span>
                            </label>
                            
                            <div className="batch-info">
                                <p>{batchVerification.proofs.length} proofs in batch</p>
                                <button
                                    className="batch-action-btn"
                                    onClick={batchVerify}
                                    disabled={batchVerification.proofs.length === 0}
                                >
                                    <i className="fas fa-play"></i>
                                    Verify Batch
                                </button>
                            </div>
                        </div>
                        
                        {batchVerification.enabled && (
                            <div className="batch-list">
                                <h4>Proofs in Batch</h4>
                                
                                {batchVerification.proofs.length > 0 ? (
                                    <div className="batch-items">
                                        {batchVerification.proofs.map((proof, index) => (
                                            <div key={index} className="batch-item">
                                                <span className="proof-id">{proof.proofId.substring(0, 16)}...</span>
                                                <button
                                                    className="remove-btn"
                                                    onClick={() => removeProofFromBatch(proof.proofId)}
                                                >
                                                    <i className="fas fa-times"></i>
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="empty-batch">Add proofs from pending requests</p>
                                )}
                                
                                {batchVerification.results.length > 0 && (
                                    <div className="batch-results">
                                        <h4>Results</h4>
                                        <div className="results-summary">
                                            <span className="valid-count">
                                                {batchVerification.results.filter(r => r.valid).length} valid
                                            </span>
                                            <span className="invalid-count">
                                                {batchVerification.results.filter(r => !r.valid).length} invalid
                                            </span>
                                        </div>
                                        
                                        <div className="detailed-results">
                                            {batchVerification.results.map((result, index) => (
                                                <div key={index} className={`result-item ${result.valid ? 'valid' : 'invalid'}`}>
                                                    <span className="result-proof">{result.proofId.substring(0, 12)}...</span>
                                                    <span className="result-status">
                                                        {result.valid ? '✓ Valid' : '✗ Invalid'}
                                                    </span>
                                                    {result.error && (
                                                        <span className="result-error">{result.error}</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Verification History */}
                    <div className="verification-history">
                        <div className="history-header">
                            <h3><i className="fas fa-history"></i> Verification History</h3>
                            <button className="export-btn" onClick={exportVerificationReport}>
                                <i className="fas fa-file-export"></i> Export Report
                            </button>
                        </div>
                        
                        <div className="history-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Proof ID</th>
                                        <th>User</th>
                                        <th>Status</th>
                                        <th>Fee</th>
                                        <th>Time</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {verifications.map(verification => (
                                        <tr key={verification.id}>
                                            <td className="proof-id">
                                                {verification.proofId.substring(0, 10)}...
                                            </td>
                                            <td>
                                                {verification.user.substring(0, 8)}...
                                            </td>
                                            <td>
                                                <span className={`status-badge ${verification.status}`}>
                                                    {verification.status === 'verified' ? (
                                                        <>
                                                            <i className="fas fa-check-circle"></i> Verified
                                                            {verification.onChain && <span className="chain-badge">⛓️</span>}
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="fas fa-times-circle"></i> Rejected
                                                        </>
                                                    )}
                                                </span>
                                            </td>
                                            <td>
                                                {verification.feePaid > 0 ? (
                                                    <span className="fee-amount">{verification.feePaid} ETH</span>
                                                ) : (
                                                    <span className="no-fee">Free</span>
                                                )}
                                            </td>
                                            <td>
                                                {new Date(verification.timestamp).toLocaleDateString()}
                                            </td>
                                            <td className="history-actions">
                                                <button
                                                    className="view-btn"
                                                    onClick={() => alert(`Viewing verification ${verification.id}`)}
                                                >
                                                    <i className="fas fa-eye"></i>
                                                </button>
                                                <button
                                                    className="reverify-btn"
                                                    onClick={() => verifyProof({
                                                        proofId: verification.proofId,
                                                        proofData: {}, // Would be actual data
                                                        user: verification.user,
                                                        requirements: verification.requirements
                                                    })}
                                                >
                                                    <i className="fas fa-redo"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            
                            {verifications.length === 0 && (
                                <div className="no-history">
                                    <i className="fas fa-history"></i>
                                    <p>No verification history yet</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* API Integration Section */}
            <div className="api-integration">
                <h3><i className="fas fa-code"></i> API Integration</h3>
                
                <div className="api-endpoints">
                    <div className="endpoint-card">
                        <h4>Verify Proof Endpoint</h4>
                        <code className="endpoint-url">
                            POST /api/verify
                        </code>
                        <pre className="endpoint-example">
{`{
  "proof": "zk-proof-data",
  "publicSignals": [...],
  "nullifier": "0x..."
}`}
                        </pre>
                    </div>
                    
                    <div className="endpoint-card">
                        <h4>Webhook Configuration</h4>
                        <div className="webhook-settings">
                            <input
                                type="url"
                                placeholder="https://your-service.com/webhook"
                                className="webhook-url"
                            />
                            <button className="test-webhook-btn">
                                <i className="fas fa-bell"></i> Test Webhook
                            </button>
                        </div>
                        <p className="webhook-info">
                            Receive real-time notifications when proofs are verified
                        </p>
                    </div>
                </div>
            </div>
            
            {/* Analytics Section */}
            <div className="analytics-section">
                <h3><i className="fas fa-chart-line"></i> Analytics</h3>
                
                <div className="analytics-cards">
                    <div className="analytics-card">
                        <h4>Verification Trends</h4>
                        <div className="trend-chart">
                            {/* In production, use a charting library */}
                            <div className="chart-placeholder">
                                <p>Verification volume over time chart</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="analytics-card">
                        <h4>Success Rate</h4>
                        <div className="success-rate">
                            <div className="rate-circle">
                                <div className="rate-value">
                                    {verificationStats.totalVerified > 0 ? 
                                        Math.round((verificationStats.totalVerified / 
                                        (verificationStats.totalVerified + verificationStats.rejected) * 100)) : 
                                        0}%
                                </div>
                            </div>
                            <div className="rate-details">
                                <p><span className="verified-count">{verificationStats.totalVerified}</span> successful</p>
                                <p><span className="rejected-count">{verificationStats.rejected}</span> rejected</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="analytics-card">
                        <h4>Top Requirements</h4>
                        <div className="requirements-list">
                            <div className="requirement-item">
                                <span className="req-label">Age ≥ 18</span>
                                <span className="req-count">847</span>
                            </div>
                            <div className="requirement-item">
                                <span className="req-label">Age ≥ 21</span>
                                <span className="req-count">321</span>
                            </div>
                            <div className="requirement-item">
                                <span className="req-label">US Only</span>
                                <span className="req-count">456</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default VerifierDashboard;