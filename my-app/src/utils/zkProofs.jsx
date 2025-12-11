// src/utils/zkProofs.js

/**
 * Generate a mock zero-knowledge proof for demonstration purposes
 * In production, this would use actual zk-SNARK/STARK libraries
 */
export const generateProof = async (formData, requirements) => {
    // Simulate proof generation time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate a mock proof
    const timestamp = Date.now();
    const proofId = `proof_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    
    return {
        id: proofId,
        proof: {
            a: [
                `0x${randomHex(32)}`,
                `0x${randomHex(32)}`
            ],
            b: [
                [`0x${randomHex(32)}`, `0x${randomHex(32)}`],
                [`0x${randomHex(32)}`, `0x${randomHex(32)}`]
            ],
            c: [
                `0x${randomHex(32)}`,
                `0x${randomHex(32)}`
            ]
        },
        publicSignals: [
            `0x${randomHex(32)}`,
            `0x${randomHex(32)}`,
            `0x${randomHex(32)}`
        ],
        nullifier: generateNullifier(formData.documentNumber, formData.dob),
        circuit: 'kyc_verification_v1',
        timestamp,
        requirements
    };
};

/**
 * Generate a nullifier hash to prevent proof reuse
 */
export const generateNullifier = (documentNumber, dob) => {
    // In production, this would use a proper cryptographic hash
    const data = `${documentNumber}_${dob}_${Date.now()}_${Math.random()}`;
    const hash = simpleHash(data);
    return `0x${hash}`;
};

/**
 * Verify a zero-knowledge proof
 */
export const verifyProof = async (proofData) => {
    // Simulate verification time
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Mock verification - always returns true for demo
    // In production, this would use actual zk-SNARK verification
    return {
        success: true,
        verified: true,
        proofId: proofData.id,
        timestamp: Date.now(),
        onChain: false
    };
};

/**
 * Generate a credential hash
 */
export const generateCredentialHash = (credentialData) => {
    const data = JSON.stringify(credentialData);
    return `0x${simpleHash(data)}`;
};

/**
 * Generate a commitment for on-chain storage
 */
export const generateCommitment = (credentialId, userAddress) => {
    const data = `${credentialId}_${userAddress}_${Date.now()}`;
    return `0x${simpleHash(data)}`;
};

/**
 * Simple hash function for demonstration
 * In production, use proper cryptographic libraries
 */
const simpleHash = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(64, '0').slice(0, 64);
};

/**
 * Generate random hex string
 */
const randomHex = (bytes) => {
    const hex = [];
    for (let i = 0; i < bytes * 2; i++) {
        hex.push(Math.floor(Math.random() * 16).toString(16));
    }
    return hex.join('');
};

/**
 * Prepare circuit inputs for proof generation
 */
export const prepareCircuitInputs = (formData, requirements) => {
    return {
        // Private inputs (not revealed)
        private: {
            nameHash: simpleHash(formData.fullName),
            dobHash: simpleHash(formData.dob),
            documentHash: simpleHash(formData.documentNumber),
            countryHash: simpleHash(formData.country)
        },
        // Public inputs (revealed in proof)
        public: {
            minAge: requirements.minAge || 18,
            allowedCountries: requirements.allowedCountries || [],
            timestamp: Date.now(),
            circuitId: 'kyc_circuit_v1'
        }
    };
};

/**
 * Calculate age from date of birth
 */
export const calculateAge = (dobString) => {
    const dob = new Date(dobString);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        age--;
    }
    
    return age;
};

/**
 * Check if user meets requirements
 */
export const checkRequirements = (userData, requirements) => {
    const age = calculateAge(userData.dob);
    const errors = [];
    
    if (age < requirements.minAge) {
        errors.push(`Minimum age requirement not met: ${age} < ${requirements.minAge}`);
    }
    
    if (requirements.allowedCountries && requirements.allowedCountries.length > 0) {
        if (!requirements.allowedCountries.includes(userData.country)) {
            errors.push(`Country not allowed: ${userData.country}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors,
        age
    };
};

export default {
    generateProof,
    generateNullifier,
    verifyProof,
    generateCredentialHash,
    generateCommitment,
    prepareCircuitInputs,
    calculateAge,
    checkRequirements
};