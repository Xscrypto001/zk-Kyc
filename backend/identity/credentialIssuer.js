const crypto = require('crypto');
const ethers = require('ethers');
const { sign } = require('jsonwebtoken');

class CredentialIssuer {
    constructor(issuerConfig) {
        this.issuerName = issuerConfig.name || 'Trusted KYC Issuer';
        this.issuerId = issuerConfig.issuerId;
        this.privateKey = issuerConfig.privateKey;
        this.publicKey = issuerConfig.publicKey;
        
        // Credential templates
        this.templates = new Map();
        this.issuedCredentials = new Map();
        this.revokedCredentials = new Set();
        
        // Initialize with default templates
        this.initializeTemplates();
    }
    
    /**
     * Initialize credential templates
     */
    initializeTemplates() {
        // Basic KYC template
        this.templates.set('basic_kyc', {
            name: 'Basic KYC Verification',
            version: '1.0',
            attributes: ['fullName', 'dateOfBirth', 'country', 'documentType', 'isAdult'],
            validityPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year in milliseconds
            requires: ['documentVerification', 'livenessCheck']
        });
        
        // Enhanced KYC template
        this.templates.set('enhanced_kyc', {
            name: 'Enhanced KYC Verification',
            version: '1.0',
            attributes: ['fullName', 'dateOfBirth', 'country', 'address', 'nationality', 
                        'documentType', 'documentNumber', 'isAdult', 'sanctionsCheck'],
            validityPeriod: 365 * 24 * 60 * 60 * 1000,
            requires: ['documentVerification', 'livenessCheck', 'addressVerification']
        });
        
        // Age verification only template
        this.templates.set('age_verification', {
            name: 'Age Verification',
            version: '1.0',
            attributes: ['isAdult', 'dateOfBirth', 'minAge'],
            validityPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
            requires: ['ageVerification']
        });
    }
    
    /**
     * Issue a credential to a user
     */
    async issueCredential(userData, templateId = 'basic_kyc') {
        const template = this.templates.get(templateId);
        if (!template) {
            throw new Error(`Template ${templateId} not found`);
        }
        
        // Validate user data against template requirements
        const validation = this.validateUserData(userData, template);
        if (!validation.valid) {
            throw new Error(`Invalid user data: ${validation.errors.join(', ')}`);
        }
        
        // Generate credential ID
        const credentialId = this.generateCredentialId(userData.userAddress);
        
        // Create credential payload
        const credential = {
            '@context': [
                'https://www.w3.org/2018/credentials/v1',
                'https://zkkyc.example/credentials/v1'
            ],
            id: `urn:uuid:${credentialId}`,
            type: ['VerifiableCredential', 'KYCVerificationCredential'],
            issuer: {
                id: this.issuerId,
                name: this.issuerName,
                type: 'KYCIssuer'
            },
            issuanceDate: new Date().toISOString(),
            expirationDate: new Date(Date.now() + template.validityPeriod).toISOString(),
            credentialSubject: {
                id: `did:ethr:${userData.userAddress}`,
                ...this.extractCredentialSubject(userData, template)
            },
            credentialSchema: {
                id: `https://zkkyc.example/schemas/${templateId}`,
                type: 'JsonSchemaValidator2018'
            },
            credentialStatus: {
                id: `https://issuer.zkkyc.example/credentials/status/${credentialId}`,
                type: 'CredentialStatusList2021'
            },
            proof: null // Will be added after signing
        };
        
        // Sign the credential
        const signedCredential = await this.signCredential(credential);
        
        // Generate zero-knowledge commitment
        const commitment = this.generateZKCommitment(signedCredential);
        
        // Generate selective disclosure key
        const disclosureKey = this.generateDisclosureKey(credentialId);
        
        // Store credential
        this.issuedCredentials.set(credentialId, {
            credential: signedCredential,
            commitment,
            userAddress: userData.userAddress.toLowerCase(),
            templateId,
            issuedAt: Date.now(),
            status: 'active',
            disclosureKey
        });
        
        return {
            success: true,
            credentialId,
            credential: signedCredential,
            commitment,
            disclosureKey,
            issuer: this.issuerId,
            template: template.name
        };
    }
    
    /**
     * Generate a selective disclosure proof
     */
    async generateSelectiveDisclosure(credentialId, requestedAttributes) {
        const credentialRecord = this.issuedCredentials.get(credentialId);
        if (!credentialRecord) {
            throw new Error('Credential not found');
        }
        
        if (credentialRecord.status !== 'active') {
            throw new Error(`Credential status is ${credentialRecord.status}`);
        }
        
        const credential = credentialRecord.credential;
        
        // Filter attributes based on request
        const disclosedAttributes = {};
        const undisclosedAttributes = [];
        
        for (const attr of requestedAttributes) {
            if (credential.credentialSubject[attr] !== undefined) {
                disclosedAttributes[attr] = credential.credentialSubject[attr];
            } else {
                undisclosedAttributes.push(attr);
            }
        }
        
        // Generate proof of selective disclosure
        const disclosureProof = await this.createDisclosureProof(
            credentialId,
            disclosedAttributes,
            undisclosedAttributes
        );
        
        return {
            success: true,
            disclosedAttributes,
            proof: disclosureProof,
            commitment: credentialRecord.commitment,
            credentialId
        };
    }
    
    /**
     * Revoke a credential
     */
    revokeCredential(credentialId, reason = '') {
        const credentialRecord = this.issuedCredentials.get(credentialId);
        if (!credentialRecord) {
            throw new Error('Credential not found');
        }
        
        credentialRecord.status = 'revoked';
        credentialRecord.revokedAt = Date.now();
        credentialRecord.revocationReason = reason;
        
        this.issuedCredentials.set(credentialId, credentialRecord);
        this.revokedCredentials.add(credentialId);
        
        // Update credential status list
        this.updateStatusList(credentialId, 'revoked');
        
        return {
            success: true,
            credentialId,
            revokedAt: credentialRecord.revokedAt,
            reason
        };
    }
    
    /**
     * Verify a credential
     */
    async verifyCredential(credentialId, proof) {
        const credentialRecord = this.issuedCredentials.get(credentialId);
        if (!credentialRecord) {
            return {
                valid: false,
                error: 'Credential not found'
            };
        }
        
        // Check if credential is revoked
        if (credentialRecord.status === 'revoked') {
            return {
                valid: false,
                error: 'Credential revoked',
                revokedAt: credentialRecord.revokedAt,
                reason: credentialRecord.revocationReason
            };
        }
        
        // Check if credential is expired
        const expirationDate = new Date(credentialRecord.credential.expirationDate);
        if (expirationDate < new Date()) {
            return {
                valid: false,
                error: 'Credential expired',
                expiredAt: expirationDate.toISOString()
            };
        }
        
        // Verify proof if provided
        let proofValid = true;
        if (proof) {
            proofValid = await this.verifyDisclosureProof(credentialId, proof);
        }
        
        // Verify issuer signature
        const signatureValid = await this.verifySignature(credentialRecord.credential);
        
        return {
            valid: signatureValid && proofValid,
            credentialId,
            status: credentialRecord.status,
            issuer: this.issuerId,
            issuedAt: credentialRecord.issuedAt,
            expiresAt: credentialRecord.credential.expirationDate,
            subject: credentialRecord.credential.credentialSubject.id,
            attributes: credentialRecord.credential.credentialSubject
        };
    }
    
    /**
     * Generate a zero-knowledge proof from a credential
     */
    async generateZKProof(credentialId, circuitRequirements) {
        const credentialRecord = this.issuedCredentials.get(credentialId);
        if (!credentialRecord) {
            throw new Error('Credential not found');
        }
        
        // Extract circuit inputs from credential
        const circuitInputs = this.prepareCircuitInputs(
            credentialRecord.credential,
            circuitRequirements
        );
        
        // Generate nullifier
        const nullifier = this.generateNullifier(credentialId, circuitRequirements);
        
        // In production, this would generate actual zk-SNARK proof
        const zkProof = {
            proof: {
                a: ['0x123...', '0x456...'],
                b: [['0x789...', '0xabc...'], ['0xdef...', '0x123...']],
                c: ['0x456...', '0x789...']
            },
            publicSignals: [
                nullifier,
                credentialRecord.commitment,
                ...Object.values(circuitInputs.public)
            ]
        };
        
        // Store proof reference
        credentialRecord.zkProofs = credentialRecord.zkProofs || [];
        credentialRecord.zkProofs.push({
            nullifier,
            circuitRequirements,
            generatedAt: Date.now()
        });
        
        return {
            success: true,
            proof: zkProof,
            nullifier,
            circuit: 'kyc_circuit_v1',
            verifier: '0x...' // Verifier contract address
        };
    }
    
    /**
     * Helper methods
     */
    generateCredentialId(userAddress) {
        const hash = crypto.createHash('sha256');
        hash.update(userAddress + Date.now() + crypto.randomBytes(16).toString('hex'));
        return hash.digest('hex').substring(0, 32);
    }
    
    generateZKCommitment(credential) {
        const hash = crypto.createHash('sha256');
        hash.update(JSON.stringify(credential.credentialSubject));
        hash.update(credential.issuanceDate);
        return '0x' + hash.digest('hex');
    }
    
    generateDisclosureKey(credentialId) {
        return crypto.randomBytes(32).toString('hex');
    }
    
    generateNullifier(credentialId, requirements) {
        const hash = crypto.createHash('sha256');
        hash.update(credentialId + JSON.stringify(requirements) + Date.now());
        return '0x' + hash.digest('hex');
    }
    
    validateUserData(userData, template) {
        const errors = [];
        const requiredAttrs = template.attributes;
        
        for (const attr of requiredAttrs) {
            if (userData[attr] === undefined) {
                errors.push(`Missing required attribute: ${attr}`);
            }
        }
        
        // Special validation for age
        if (requiredAttrs.includes('isAdult')) {
            if (userData.dateOfBirth) {
                const age = this.calculateAge(userData.dateOfBirth);
                if (age < 18) {
                    errors.push('User must be at least 18 years old');
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    calculateAge(dateOfBirth) {
        const birthDate = new Date(dateOfBirth);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        return age;
    }
    
    extractCredentialSubject(userData, template) {
        const subject = {};
        
        for (const attr of template.attributes) {
            if (userData[attr] !== undefined) {
                subject[attr] = userData[attr];
            }
        }
        
        // Add calculated attributes
        if (template.attributes.includes('isAdult')) {
            subject.isAdult = this.calculateAge(userData.dateOfBirth) >= 18;
        }
        
        return subject;
    }
    
    async signCredential(credential) {
        // In production, use actual JWT or other signing mechanism
        // This is a mock implementation
        const payload = {
            ...credential,
            proof: {
                type: 'JwtProof2020',
                jwt: 'mock-jwt-token-' + Date.now()
            }
        };
        
        return payload;
    }
    
    async verifySignature(credential) {
        // Mock verification
        return credential.proof && credential.proof.jwt;
    }
    
    async createDisclosureProof(credentialId, disclosed, undisclosed) {
        // Mock disclosure proof
        return {
            type: 'SelectiveDisclosureProof',
            credentialId,
            disclosedAttributes: Object.keys(disclosed),
            proof: '0x' + crypto.randomBytes(64).toString('hex'),
            timestamp: Date.now()
        };
    }
    
    async verifyDisclosureProof(credentialId, proof) {
        // Mock verification
        return proof && proof.type === 'SelectiveDisclosureProof';
    }
    
    prepareCircuitInputs(credential, requirements) {
        const subject = credential.credentialSubject;
        
        return {
            private: {
                // Private inputs (not revealed in proof)
                fullNameHash: this.hashAttribute(subject.fullName),
                dobHash: this.hashAttribute(subject.dateOfBirth),
                documentHash: this.hashAttribute(subject.documentNumber)
            },
            public: {
                // Public inputs (revealed in proof)
                minAge: requirements.minAge || 18,
                allowedCountry: requirements.country || 'ANY',
                credentialRoot: this.hashAttribute(JSON.stringify(subject))
            }
        };
    }
    
    hashAttribute(value) {
        const hash = crypto.createHash('sha256');
        hash.update(String(value));
        return '0x' + hash.digest('hex');
    }
    
    updateStatusList(credentialId, status) {
        // In production, update a public status list
        console.log(`Credential ${credentialId} status updated to ${status}`);
    }
    
    /**
     * Get issuer statistics
     */
    getStats() {
        const total = this.issuedCredentials.size;
        const active = Array.from(this.issuedCredentials.values())
            .filter(c => c.status === 'active').length;
        const revoked = this.revokedCredentials.size;
        
        return {
            totalCredentials: total,
            activeCredentials: active,
            revokedCredentials: revoked,
            templates: this.templates.size,
            issuer: this.issuerName
        };
    }
    
    /**
     * Export public key for verification
     */
    getPublicKeyInfo() {
        return {
            issuerId: this.issuerId,
            issuerName: this.issuerName,
            publicKey: this.publicKey,
            supportedTemplates: Array.from(this.templates.keys()),
            credentialStatusEndpoint: `https://issuer.zkkyc.example/status/{id}`
        };
    }
}

module.exports = CredentialIssuer;