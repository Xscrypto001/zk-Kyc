📚 zkKYC Platform - Complete Documentation
Table of Contents

    Overview

    Architecture

    Setup & Installation

    Running the Application

    Smart Contracts

    Zero-Knowledge Proofs

    Frontend UI

    Backend Services

    Testing

    Deployment

    API Reference

    Troubleshooting

    Security Considerations

🔍 Overview
What is zkKYC Platform?

A privacy-preserving KYC (Know Your Customer) verification system built on Base Network (Ethereum L2) that uses Zero-Knowledge Proofs to verify user identity without revealing personal information.
Key Features

    ✅ Privacy-First: Personal data never leaves user's device

    ✅ Zero-Knowledge Proofs: Cryptographic verification without data exposure

    ✅ Base Network Integration: Low-cost, fast transactions on Ethereum L2

    ✅ Trusted Issuer Model: Regulated entities issue verifiable credentials

    ✅ Selective Disclosure: Users control what information to reveal

    ✅ Proof Non-Replay: Unique nullifiers prevent proof reuse

🏗️ Architecture
System Architecture Diagram
text

┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    Frontend     │────▶│    Backend      │────▶│  Blockchain     │
│  (React/Vite)   │     │ (Node.js/Express)│     │  (Base Network)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                        │                        │
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   ZK Circuits   │     │  KYC Issuers    │     │  Smart Contracts │
│   (Circom)      │     │  (Trusted)      │     │  (Solidity)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘

Data Flow

    User submits KYC information via frontend

    Trusted Issuer verifies identity off-chain

    ZK Proof generated locally in browser

    Proof submitted to Base Network

    Verifier checks proof without seeing personal data

    Service grants access based on proof validity

⚙️ Setup & Installation
Prerequisites

    Node.js 16+ and npm/yarn

    MetaMask browser extension

    Git

1. Clone Repository
bash

git clone https://github.com/your-org/zkkyc-platform.git
cd zkkyc-platform

2. Install Dependencies
Frontend (Vite + React)
bash

cd frontend
npm install

Backend (Node.js + Express)
bash

cd backend
npm install

Smart Contracts (Hardhat)
bash

cd contracts
npm install

3. Environment Setup
Create .env files:

Frontend (.env)
env

VITE_BASE_RPC_URL=https://mainnet.base.org
VITE_CONTRACT_ADDRESS=0x...
VITE_BACKEND_URL=http://localhost:3001

Backend (.env)
env

PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/zkkyc
JWT_SECRET=your_jwt_secret_here
RPC_URL=https://mainnet.base.org
CONTRACT_ADDRESS=0x...
PRIVATE_KEY=your_private_key_here

Contracts (.env)
env

BASE_RPC_URL=https://mainnet.base.org
PRIVATE_KEY=your_deployer_private_key
ETHERSCAN_API_KEY=your_etherscan_key

🚀 Running the Application
Option 1: Development Mode (Recommended)
1. Start Backend Server
bash

cd backend
npm run dev
# Server runs on http://localhost:3001

2. Start Frontend
bash

cd frontend
npm run dev
# App runs on http://localhost:5173

3. Deploy Contracts (Local)
bash

cd contracts
npx hardhat node
# In another terminal:
npx hardhat run scripts/deploy.js --network localhost

Option 2: Docker Compose (Production-like)
bash

docker-compose up --build

Option 3: Demo Mode (No Blockchain)
bash

cd frontend
npm run demo
# Runs with mock data, no blockchain required

📝 Smart Contracts
Contract Architecture
1. ZkKYCRegistry.sol

Main registry contract managing KYC status and proof verification.

Key Functions:
solidity

// Register KYC for a user
function registerKYC(address user, uint256 expiry, bytes32 credentialRoot)

// Verify ZK proof
function verifyProof(bytes calldata proof, bytes32 nullifier, bytes32 credentialRoot)

// Check KYC status
function hasValidKYC(address user) view returns (bool)

2. ZkVerifier.sol

Groth16 verifier contract for zk-SNARK proofs.

Verification Interface:
solidity

function verifyProof(
    uint[2] memory a,
    uint[2][2] memory b,
    uint[2] memory c,
    uint[2] memory input
) public view returns (bool)

Deployment Scripts
Deploy to Base Mainnet
bash

cd contracts
npx hardhat run scripts/deploy.js --network base

Verify Contract
bash

npx hardhat verify --network base DEPLOYED_ADDRESS "Constructor arguments"

Contract Addresses

    Mainnet: 0x... (Update after deployment)

    Testnet: 0x... (Update after deployment)

    Local: 0x5FbDB2315678afecb367f032d93F642f64180aa3

🔐 Zero-Knowledge Proofs
Circuit Design
KYC Verification Circuit (circom)
circom

pragma circom 2.1.5;

template KYCVerification() {
    // Private inputs
    signal input privateKey;
    signal input dobHash;
    signal input countryCode;
    signal input documentHash;
    
    // Public inputs
    signal input minAge;
    signal input allowedCountriesHash;
    signal input credentialRoot;
    signal input currentDate;
    
    // Outputs
    signal output isValid;
    signal output nullifier;
    
    // Circuit logic
    // 1. Age verification
    // 2. Country verification
    // 3. Document validation
    // 4. Nullifier generation
}

Proof Generation Workflow
1. Install Circuit Tools
bash

npm install -g circom snarkjs

2. Compile Circuit
bash

cd circuits
circom kyc-circuit.circom --r1cs --wasm --sym

3. Trusted Setup
bash

# Phase 1
snarkjs powersoftau new bn128 12 pot12_0000.ptau
snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau

# Phase 2
snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau
snarkjs groth16 setup kyc-circuit.r1cs pot12_final.ptau circuit_0000.zkey

4. Generate Proof (JavaScript)
javascript

const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    inputs,
    "kyc-circuit.wasm",
    "circuit_final.zkey"
);

5. Verify Proof
javascript

const isValid = await snarkjs.groth16.verify(
    verificationKey,
    publicSignals,
    proof
);

Mock Proof Generation (Development)

For development without actual circuit compilation:
javascript

// src/utils/zkProofs.js
export const generateMockProof = (formData) => {
    return {
        proof: {
            a: ['0x123...', '0x456...'],
            b: [['0x789...', '0xabc...'], ['0xdef...', '0x123...']],
            c: ['0x456...', '0x789...']
        },
        publicSignals: [
            '0x' + hash(formData.documentNumber),
            '0x' + hash(formData.country)
        ],
        nullifier: generateNullifier(formData)
    };
};

🎨 Frontend UI
Component Structure
text

src/
├── components/
│   ├── KYCForm.jsx          # KYC submission form
│   ├── ProofGenerator.jsx   # ZK proof generation
│   ├── VerifierDashboard.jsx # Proof verification dashboard
│   └── WalletConnect.jsx    # MetaMask connection
├── utils/
│   ├── zkProofs.js         # ZK proof utilities
│   ├── blockchain.js       # Web3 interactions
│   └── api.js             # Backend API calls
└── App.jsx                # Main application

Key Pages
1. Landing Page

    Wallet connection

    Platform overview

    Demo mode option

2. KYC Verification
jsx

// Form fields
- Full Name (encrypted)
- Date of Birth (hashed)
- Country (coded)
- Document Type/Number (hashed)
- Document Upload (encrypted)

3. Proof Generator

    Customizable requirements (age, country, etc.)

    Proof generation interface

    Proof history management

    Export functionality

4. Verifier Dashboard

    Pending proof requests

    Batch verification

    Verification history

    Analytics dashboard

State Management
javascript

// App state structure
{
  userAddress: '0x...',
  network: 'Base',
  credential: {
    id: 'cred_123',
    issuedAt: timestamp,
    expiryDate: timestamp,
    verified: true
  },
  proofs: [],
  pendingVerifications: []
}

⚡ Backend Services
API Endpoints
1. Authentication
http

POST /api/auth/login
POST /api/auth/register
GET /api/auth/verify-jwt

2. KYC Issuance
http

POST /api/kyc/submit
POST /api/kyc/verify
GET /api/kyc/status/:userId

3. Proof Management
http

POST /api/proofs/generate
POST /api/proofs/verify
GET /api/proofs/:userId
DELETE /api/proofs/:proofId

4. Verification
http

POST /api/verify/submit
GET /api/verify/pending
PUT /api/verify/:verificationId

Database Schema (PostgreSQL)
sql

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    wallet_address VARCHAR(42) UNIQUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Credentials table
CREATE TABLE credentials (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    credential_hash VARCHAR(66),
    issued_at TIMESTAMP,
    expiry_date TIMESTAMP,
    issuer VARCHAR(255),
    status VARCHAR(20)
);

-- Proofs table
CREATE TABLE proofs (
    id UUID PRIMARY KEY,
    credential_id UUID REFERENCES credentials(id),
    nullifier VARCHAR(66) UNIQUE,
    circuit_id VARCHAR(50),
    proof_data JSONB,
    generated_at TIMESTAMP,
    verified BOOLEAN DEFAULT FALSE
);

Running Backend Services
bash

# Development
npm run dev

# Production
npm start

# With PM2
pm2 start server.js --name zkkyc-backend

🧪 Testing
Unit Tests
bash

# Frontend tests
cd frontend
npm test

# Smart contract tests
cd contracts
npx hardhat test

# Backend tests
cd backend
npm test

Test Coverage
bash

# Generate coverage reports
npm run coverage

# View in browser
open coverage/lcov-report/index.html

Integration Tests
bash

# Run all tests
npm run test:all

# E2E tests with Cypress
npm run cypress:open

🚢 Deployment
1. Frontend Deployment (Vercel)
bash

# Build project
npm run build

# Deploy to Vercel
vercel --prod

2. Backend Deployment (Railway/Heroku)
bash

# Push to Railway
railway up

# Or Heroku
git push heroku main

3. Smart Contract Deployment
bash

# Deploy to Base Mainnet
npx hardhat run scripts/deploy.js --network base

# Verify on Basescan
npx hardhat verify --network base DEPLOYED_ADDRESS

4. Environment Configuration
bash

# Production environment variables
export DATABASE_URL=...
export RPC_URL=https://mainnet.base.org
export CONTRACT_ADDRESS=0x...
export JWT_SECRET=...

🔌 API Reference
Web3 Provider Interface
javascript

// Connect wallet
const connectWallet = async () => {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    const signer = provider.getSigner();
    return await signer.getAddress();
};

// Contract interaction
const contract = new ethers.Contract(
    contractAddress,
    contractABI,
    signer
);

// Verify proof
const tx = await contract.verifyProof(proof, nullifier, credentialRoot);
await tx.wait();

ZK Proof API
javascript

// Generate proof
const proof = await generateZKProof(userData, requirements);

// Verify proof
const isValid = await verifyZKProof(proof);

// Format for Solidity
const solidityProof = formatProofForSolidity(proof);

Backend API Client
javascript

import axios from 'axios';

const api = axios.create({
    baseURL: process.env.VITE_BACKEND_URL,
    headers: { 'Content-Type': 'application/json' }
});

// Submit KYC
const submitKYC = async (data) => {
    return await api.post('/api/kyc/submit', data);
};

// Get proofs
const getProofs = async (userId) => {
    return await api.get(`/api/proofs/${userId}`);
};

🔧 Troubleshooting
Common Issues & Solutions
1. MetaMask Connection Failed
text

Error: Failed to connect wallet

Solution:

    Ensure MetaMask is installed and unlocked

    Check if Base network is added

    Clear browser cache and restart

2. Proof Generation Error
text

Error: Circuit compilation failed

Solution:

    Install circom globally: npm install -g circom

    Check circuit syntax

    Ensure all dependencies are installed

3. Contract Deployment Failed
text

Error: Insufficient funds

Solution:

    Get test ETH from Base faucet

    Switch to Base testnet for development

    Check gas price settings

4. Backend Connection Issues
text

Error: Cannot connect to backend

Solution:

    Check if backend is running: curl http://localhost:3001/health

    Verify CORS settings

    Check firewall rules

Debug Commands
bash

# Check network status
curl https://mainnet.base.org

# Test contract interaction
npx hardhat console --network base

# Check database connection
psql $DATABASE_URL -c "\dt"

# View logs
pm2 logs zkkyc-backend

🛡️ Security Considerations
Critical Security Measures
1. Private Key Management
javascript

// NEVER expose private keys in frontend
// Use environment variables in backend
const privateKey = process.env.PRIVATE_KEY;

2. Input Validation
javascript

// Validate all user inputs
const validateKYCData = (data) => {
    if (!isValidEthereumAddress(data.userAddress)) {
        throw new Error('Invalid address');
    }
    if (data.age < 0 || data.age > 150) {
        throw new Error('Invalid age');
    }
    // ... more validations
};

3. Proof Replay Protection
solidity

// Smart contract: prevent proof reuse
mapping(bytes32 => bool) public nullifiers;

function verifyProof(bytes32 nullifier) public {
    require(!nullifiers[nullifier], "Proof already used");
    nullifiers[nullifier] = true;
    // ... verification logic
}

4. Rate Limiting
javascript

// Implement rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

Audit Checklist

    Smart contracts audited

    ZK circuits reviewed

    Frontend security tested

    Backend API secured

    Database encryption enabled

    SSL/TLS implemented

    DDoS protection configured

    Regular security updates

📊 Monitoring & Analytics
Logging Setup
javascript

// Winston logger configuration
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.json(),
    transports: [
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

Metrics Collection
javascript

// Prometheus metrics
const prometheus = require('prom-client');
const register = new prometheus.Registry();

// Custom metrics
const proofsGenerated = new prometheus.Counter({
    name: 'proofs_generated_total',
    help: 'Total number of ZK proofs generated'
});

Alerting Rules
yaml

# AlertManager configuration
groups:
  - name: zkkyc-alerts
    rules:
    - alert: HighErrorRate
      expr: rate(http_requests_total{status="500"}[5m]) > 0.1
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "High error rate detected"

🚀 Quick Start Cheat Sheet
1. Development Setup
bash

# Clone and install
git clone <repo-url>
cd zkkyc-platform
npm run setup

# Start services
npm run dev:all

2. Production Deployment
bash

# Build and deploy
npm run build:all
npm run deploy:production

# Verify deployment
npm run verify:all

3. Common Commands
bash

# Reset development environment
npm run reset

# Run all tests
npm test

# Format code
npm run format

# Lint code
npm run lint

# Generate documentation
npm run docs

📖 Additional Resources
Documentation Links

    Base Network Documentation

    Circom Documentation

    Hardhat Documentation

    Ethers.js Documentation

Useful Tools

    Base Faucet: Get test ETH for Base network

    Basescan: Block explorer for Base

    Circom Playground: Test circuits online

    SnarkJS: ZK-SNARK implementation

Community & Support

    Discord: Join our community channel

    GitHub Issues: Report bugs and feature requests

    Documentation: Visit docs.zkkyc.com

    Email Support: support@zkkyc.com

🎯 Next Steps
Phase 1: MVP Complete

    ✅ Basic KYC submission

    ✅ ZK proof generation

    ✅ Proof verification

    ✅ Base network integration

Phase 2: Enhanced Features

    Multi-signature issuer approval

    Credential revocation

    Proof aggregation

    Mobile app support

    API rate limiting

    Advanced analytics

Phase 3: Enterprise Features

    Multi-language support

    Regulatory compliance tools

    Audit logging

    Advanced reporting

    Integration marketplace