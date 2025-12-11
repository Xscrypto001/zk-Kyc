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
        navig