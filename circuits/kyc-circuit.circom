pragma circom 2.1.5;

include "node_modules/circomlib/circuits/comparators.circom";
include "node_modules/circomlib/circuits/sha256/sha256.circom";
include "node_modules/circomlib/circuits/mimc.circom";

template KYCVerification() {
    // Private inputs (known only to prover)
    signal input privateKey;
    signal input dobHash; // Date of birth hash
    signal input countryCode;
    signal input documentNumberHash;
    
    // Public inputs
    signal input minAge; // Minimum age required
    signal input allowedCountriesHash; // Hash of allowed countries
    signal input credentialRoot; // Merkle root of credentials
    signal input currentDate; // Current date for age calculation
    
    // Outputs
    signal output isValid;
    signal output nullifier;
    
    // Components
    component ageCheck = GreaterEqThan(32); // Check if age >= minAge
    component countryCheck = IsEqual(); // Check if country is allowed
    component hashPrivate = Sha256(4); // Hash private inputs for nullifier
    component mimc = MiMC7(91); // For commitment
    
    // Calculate age (simplified - in production would use proper date logic)
    // This is a placeholder for age verification logic
    signal computedAge;
    computedAge <== (currentDate - dobHash) / 10000000000; // Simplified
    
    // Check age requirement
    ageCheck.in[0] <== computedAge;
    ageCheck.in[1] <== minAge;
    
    // Check country (simplified - would compare hashes in production)
    // In production, this would be a Merkle tree inclusion proof
    countryCheck.in[0] <== countryCode;
    countryCheck.in[1] <== 1; // Example: country code 1 is allowed
    
    // Generate nullifier hash to prevent proof reuse
    hashPrivate.in[0] <== privateKey;
    hashPrivate.in[1] <== dobHash;
    hashPrivate.in[2] <== countryCode;
    hashPrivate.in[3] <== documentNumberHash;
    
    nullifier <== hashPrivate.out[0];
    
    // Generate commitment (in production would be Merkle leaf)
    mimc.x <== privateKey;
    
    // Verify all conditions are met
    isValid <== ageCheck.out * countryCheck.out;
}

component main = KYCVerification();