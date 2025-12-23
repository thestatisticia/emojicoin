import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import './index.css'
import { configureChains, createConfig, WagmiConfig } from 'wagmi';
import { publicProvider } from 'wagmi/providers/public';
import { getDefaultWallets } from '@rainbow-me/rainbowkit';
import { InjectedConnector } from '@wagmi/core/connectors/injected';

// QIE Network Definition
const qieChain = {
    id: 1990,
    name: 'QIEMainnet',
    network: 'qie',
    nativeCurrency: {
        decimals: 18,
        name: 'QIEV3',
        symbol: 'QIEV3',
    },
    rpcUrls: {
        public: { http: ['https://rpc1mainnet.qie.digital/', 'https://rpc2mainnet.qie.digital/', 'https://rpc5mainnet.qie.digital/'] },
        default: { http: ['https://rpc1mainnet.qie.digital/', 'https://rpc2mainnet.qie.digital/', 'https://rpc5mainnet.qie.digital/'] },
    },
    blockExplorers: {
        default: { name: 'QIE Scan', url: 'https://mainnet.qie.digital/' },
    },
    testnet: false,
};

const { chains, publicClient } = configureChains(
    [qieChain],
    [publicProvider()]
);

// Configure connectors - getDefaultWallets includes MetaMask
// Use environment variable for WalletConnect project ID, or fallback to a placeholder
// WalletConnect errors are harmless - MetaMask will still work
const walletConnectProjectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'emojicoin-launcher-qie-network';

// Initialize connectors - WalletConnect may fail with invalid project ID, but MetaMask will still work
let connectors = [];
try {
    const wallets = getDefaultWallets({
        appName: 'EmojiCoin Launcher',
        projectId: walletConnectProjectId,
        chains
    });
    // Ensure connectors is always an array
    connectors = Array.isArray(wallets?.connectors) ? wallets.connectors : [];
} catch (error) {
    console.warn('WalletConnect initialization failed (this is OK - MetaMask will still work):', error.message);
}

// Fallback: If no connectors, create injected connector using @wagmi/core
if (connectors.length === 0 && typeof window !== 'undefined' && window.ethereum) {
    console.log('Creating injected connector using @wagmi/core...');
    try {
        const injectedConnector = new InjectedConnector({
            chains: [qieChain],
            options: {
                name: 'MetaMask',
                shimDisconnect: true,
            },
        });
        
        connectors = [injectedConnector];
        console.log('✅ Injected connector created successfully');
    } catch (error) {
        console.error('Failed to create injected connector:', error);
    }
}

const wagmiConfig = createConfig({
    autoConnect: true,
    connectors,
    publicClient
})

// Global error handlers to suppress non-critical errors
if (typeof window !== 'undefined') {
    // Suppress unhandled promise rejections from wallet extensions
    window.addEventListener('unhandledrejection', (event) => {
        const errorMessage = event.reason?.message || event.reason?.toString() || '';
        const isNonCritical = 
            errorMessage.includes('MetaMask extension not found') ||
            errorMessage.includes('extension') ||
            errorMessage.includes('Receiving end does not exist') ||
            errorMessage.includes('PHANTOM') ||
            errorMessage.includes('solanaActionsContentScript') ||
            errorMessage.includes('ERR_NETWORK_CHANGED') ||
            errorMessage.includes('Failed to connect to MetaMask');
        
        if (isNonCritical) {
            event.preventDefault(); // Suppress the error
            console.warn('Suppressed non-critical error:', errorMessage);
            return;
        }
        // Let other errors through
    });
    
    // Suppress console errors from browser extensions (Phantom, etc.)
    const originalError = console.error;
    console.error = (...args) => {
        const message = args.join(' ');
        if (
            message.includes('PHANTOM') ||
            message.includes('solanaActionsContentScript') ||
            message.includes('contentScript.js') ||
            message.includes('ERR_NETWORK_CHANGED') ||
            message.includes('Failed to load resource: net::ERR_NETWORK_CHANGED')
        ) {
            // Suppress these errors silently
            return;
        }
        originalError.apply(console, args);
    };
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <WagmiConfig config={wagmiConfig}>
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </WagmiConfig>
    </React.StrictMode>,
)
