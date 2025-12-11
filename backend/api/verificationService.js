const ethers = require('ethers');
const { groth16 } = require('snarkjs');
const crypto = require('crypto');

class VerificationService {
    constructor() {
        this.credentials = new Map(); // userAddress -> credential data
        this.proofCache = new Map(); // nullifier -> proof data
        this.trustedIssuers = new Set();
        this.verifierContract = null;
        
        // Initialize with test issuers
        this.trustedIssuers.add('0x742d35Cc6634C0532925a3b844Bc9eE7a2F1d3c1');
        this.trustedIssuers.add('0x53d284357ec70cE289D6D64134DfAc8E511c8a3D');
        
        // Circuit artifacts (in production, load from files)
        this.circuitWasm = null;
        this.zkey = null;
        this.vkey = null;
    }
    
    /**
     * Initialize the verification service
     */
    async initialize(config) {
        try {
            // Load circuit artifacts
            if (config.circuitPath) {
                // In production, load actual circuit files
                // this.circuitWasm = await fs.readFile(`${config.circuitPath}/kyc-circuit.wasm`);
                // this.zkey = await fs.readFile(`${config.circuitPath}/circuit_final.zkey`);
                // this.vkey = await fs.readFile(`${config.circuitPath}/verification_key.json`);
            }
            
            // Setup blockchain connection
            if (config.rpcUrl) {
                this.provider = new ethers.providers.JsonRpcProvider(config.rpcUrl);
            }
            
            if (config.verifierContractAddress && config.verifierABI) {
                this.verifierContract = new ethers.Contract(
                    config.verifierContractAddress,
                    config.verifierABI,
                    this.provider
                );
            }
            
            console.log('Verification service initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize verification service:', error);
            throw error;
        }
    }
    
    /**
     * Issue a credential to a user after KYC verification
     */
    async issueCredential(userData) {
        const {
            userAddress,
            fullName,
            dob,
            country,
            documentType,
            documentNumber,
            expiryDate
        } = userData;
        
        // Validate input
        if (!userAddress || !ethers.utils.isAddress(userAddress)) {
            throw new Error('Invalid user address');
        }
        
        // Generate credential ID
        const credentialId = this.generateCredentialId(userAddress, documentNumber);
        
        // Create credential object
        const credential = {
            id: credentialId,
            userAddress: userAddress.toLowerCase(),
            issuer: 'zkKYC Platform',
            issuedAt: Math.floor(Date.now() / 1000),
            expiryDate: expiryDate || Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1 year
            credentialHash: this.hashCredentialData({
                fullName,
                dob,
                country,
                documentType,
                documentNumber
            }),
            attributes: {
                isAdult: this.calculateAge(dob) >= 18,
                country: country,
                documentType: documentType,
                verified: true
            },
            signature: null // Would be signed by issuer in production
        };
        
        // Store credential
        this.credentials.set(userAddress.toLowerCase(), credential);
        
        // Generate commitment for on-chain storage
        const commitment = this.generateCommitment(credential);
        
        return {
            success: true,
            credentialId,
            commitment,
            credential: {
                ...credential,
                // Don't send sensitive data back
                fullName: undefined,
                dob: undefined,
                documentNumber: undefined
            }
        };
    }
    
    /**
     * Generate a zk-SNARK proof for KYC verification
     */
    async generateProof(credentialId, requirements) {
        const credential = this.getCredentialById(credentialId);
        if (!credential) {
            throw new Error('Credential not found');
        }
        
        // Check if credential is valid
        if (credential.expiryDate < Math.floor(Date.now() / 1000)) {
            throw new Error('Credential expired');
        }
        
        // Prepare circuit inputs
        const circuitInputs = this.prepareCircuitInputs(credential, requirements);
        
        // Generate nullifier (prevents proof reuse)
        const nullifier = this.generateNullifier(credentialId, requirements);
        
        let proof;
        let publicSignals;
        
        if (this.circuitWasm && this.zkey) {
            // Generate actual zk-SNARK proof
            const { proof: zkProof, publicSignals: signals } = await groth16.fullProve(
                circuitInputs,
                this.circuitWasm,
                this.zkey
            );
            
            proof = zkProof;
            publicSignals = signals;
        } else {
            // Generate mock proof for development
            proof = this.generateMockProof(circuitInputs);
            publicSignals = [
                ethers.utils.hexZeroPad(ethers.BigNumber.from(nullifier).toHexString(), 32),
                ethers.utils.hexZeroPad(ethers.BigNumber.from(circuitInputs.credentialRoot).toHexString(), 32)
            ];
        }
        
        // Store proof reference
        this.proofCache.set(nullifier, {
            credentialId,
            generatedAt: Date.now(),
            requirements,
            verified: false
        });
        
        return {
            success: true,
            proof: this.formatProofForSolidity(proof),
            publicSignals,
            nullifier,
            verifierContract: this.verifierContract?.address
        };
    }
    
    /**
     * Verify a zk-SNARK proof
     */
    async verifyProof(proofData) {
        const { proof, publicSignals, nullifier } = proofData;
        
        // Check if proof was already used
        const cachedProof = this.proofCache.get(nullifier);
        if (cachedProof && cachedProof.verified) {
            return {
                success: false,
                error: 'Proof already used',
                nullifier
            };
        }
        
        let isValid = false;
        
        if (this.vkey && this.verifierContract) {
            // Verify proof using snarkjs
            isValid = await groth16.verify(this.vkey, publicSignals, proof);
            
            // Also verify on-chain if contract is available
            if (isValid && this.verifierContract) {
                try {
                    const onChainValid = await this.verifierContract.verifyProof(
                        proof.a,
                        proof.b,
                        proof.c,
                        publicSignals
                    );
                    isValid = onChainValid;
                } catch (error) {
                    console.error('On-chain verification failed:', error);
                }
            }
        } else {
            // Mock verification for development
            isValid = this.mockVerifyProof(proof, publicSignals);
        }
        
        if (isValid && cachedProof) {
            cachedProof.verified = true;
            cachedProof.verifiedAt = Date.now();
            this.proofCache.set(nullifier, cachedProof);
        }
        
        return {
            success: isValid,
            verified: isValid,
            nullifier,
            timestamp: Date.now()
        };
    }
    
    /**
     * Batch verify multiple proofs
     */
    async batchVerifyProofs(proofs) {
        const results = [];
        
        for (const proofData of proofs) {
            try {
                const result = await this.verifyProof(proofData);
                results.push({
                    ...result,
                    proofId: proofData.nullifier
                });
            } catch (error) {
                results.push({
                    success: false,
                    error: error.message,
                    proofId: proofData.nullifier
                });
            }
        }
        
        return {
            success: results.every(r => r.success),
            results,
            total: proofs.length,
            valid: results.filter(r => r.success).length
        };
    }
    
    /**
     * Get credential by user address
     */
    getCredential(address) {
        return this.credentials.get(address.toLowerCase());
    }
    
    /**
     * Get credential by ID
     */
    getCredentialById(credentialId) {
        for (const [address, credential] of this.credentials) {
            if (credential.id === credentialId) {
                return credential;
            }
        }
        return null;
    }
    
    /**
     * Get all proofs for a user
     */
    getUserProofs(userAddress) {
        const proofs = [];
        for (const [nullifier, proofData] of this.proofCache) {
            const credential = this.getCredentialById(proofData.credentialId);
            if (credential && credential.userAddress === userAddress.toLowerCase()) {
                proofs.push({
                    nullifier,
                    ...proofData,
                    credential
                });
            }
        }
        return proofs;
    }
    
    /**
     * Revoke a credential
     */
    revokeCredential(userAddress, reason = '') {
        const address = userAddress.toLowerCase();
        if (this.credentials.has(address)) {
            const credential = this.credentials.get(address);
            credential.revoked = true;
            credential.revocationReason = reason;
            credential.revokedAt = Math.floor(Date.now() / 1000);
            
            this.credentials.set(address, credential);
            
            // Also invalidate all proofs for this credential
            for (const [nullifier, proofData] of this.proofCache) {
                if (proofData.credentialId === credential.id) {
                    proofData.invalidated = true;
                    this.proofCache.set(nullifier, proofData);
                }
            }
            
            return {
                success: true,
                credentialId: credential.id,
                revokedAt: credential.revokedAt
            };
        }
        
        return {
            success: false,
            error: 'Credential not found'
        };
    }
    
    /**
     * Helper methods
     */
    generateCredentialId(userAddress, documentNumber) {
        const hash = crypto.createHash('sha256');
        hash.update(userAddress + documentNumber + Date.now());
        return hash.digest('hex').substring(0, 32);
    }
    
    hashCredentialData(data) {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(data));
        return '0x' + hash.digest('hex');
    }
    
    generateCommitment(credential) {
        const hash = crypto.createHash('sha256');
        hash.update(credential.id + credential.credentialHash + credential.issuedAt);
        return '0x' + hash.digest('hex');
    }
    
    generateNullifier(credentialId, requirements) {
        const hash = crypto.createHash('sha256');
        hash.update(credentialId + JSON.stringify(requirements) + Date.now() + Math.random());
        return '0x' + hash.digest('hex');
    }
    
    calculateAge(dob) {
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }
    
    prepareCircuitInputs(credential, requirements) {
        // This would prepare actual circuit inputs
        // For now, return mock data
        return {
            privateKey: '0x' + crypto.randomBytes(32).toString('hex'),
            dobHash: this.hashCredentialData({ dob: '1990-01-01' }),
            countryCode: '1',
            documentNumberHash: this.hashCredentialData({ documentNumber: 'ABC123' }),
            minAge: requirements.minAge || 18,
            allowedCountriesHash: this.hashCredentialData({ countries: ['US', 'GB', 'DE'] }),
            credentialRoot: credential.credentialHash,
            currentDate: Math.floor(Date.now() / 1000)
        };
    }
    
    generateMockProof(inputs) {
        // Generate a mock proof structure
        return {
            pi_a: [
                ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString(),
                ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString(),
                '1'
            ],
            pi_b: [
                [
                    ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString(),
                    ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString()
                ],
                [
                    ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString(),
                    ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString()
                ],
                ['1', '0']
            ],
            pi_c: [
                ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString(),
                ethers.BigNumber.from('0x' + crypto.randomBytes(32).toString('hex')).toString(),
                '1'
            ],
            protocol: 'groth16'
        };
    }
    
    formatProofForSolidity(proof) {
        // Format proof for Solidity verifier
        return {
            a: proof.pi_a.slice(0, 2),
            b: proof.pi_b.map(arr => arr.slice(0, 2)),
            c: proof.pi_c.slice(0, 2)
        };
    }
    
    mockVerifyProof(proof, publicSignals) {
        // Mock verification
        return proof && publicSignals && publicSignals.length > 0;
    }
    
    /**
     * Statistics and monitoring
     */
    getStats() {
        return {
            totalCredentials: this.credentials.size,
            totalProofs: this.proofCache.size,
            verifiedProofs: Array.from(this.proofCache.values()).filter(p => p.verified).length,
            activeCredentials: Array.from(this.credentials.values()).filter(c => 
                !c.revoked && c.expiryDate > Math.floor(Date.now() / 1000)
            ).length,
            trustedIssuers: this.trustedIssuers.size
        };
    }
    
    /**
     * Webhook for on-chain events
     */
    async handleBlockchainEvent(event) {
        // Handle events from the smart contract
        switch (event.event) {
            case 'KYCVerified':
                // Update credential status
                console.log('KYC verified on-chain:', event.args);
                break;
            case 'ProofVerified':
                // Update proof status
                console.log('Proof verified on-chain:', event.args);
                break;
            default:
                console.log('Unknown event:', event);
        }
    }
}

module.exports = VerificationService;