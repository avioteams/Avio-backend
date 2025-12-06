module.exports = {
RPC_URL: process.env.RPC_URL || 'https://api.avax-test.network/ext/bc/C/rpc',
NETWORK_ID: '0xa869',
ADMIN_ADDRESS: process.env.ADMIN_ADDRESS || '',
CONTRACTS: {
PaymentReceiptNFT: { PROXY: '0xe8a7DF5C3919b162bfdb06169D4785bAbAd4d497' },
UserRegistry: { PROXY: '0x48be716F70413E144b1Ea3270F497d7C140B2571' },
X402Adapter: { PROXY: '0x63008F1817347Ac76525B8D991a80cd863d2EB81' },
Escrow: { PROXY: '0x243119975adF2dd5D07e0f10d2833e13118C1311' },
PaymentRouter: { PROXY: '0x24c3d0bFa5C87Be372a71f4D26e4EAe7c1e263A5' }
}
};