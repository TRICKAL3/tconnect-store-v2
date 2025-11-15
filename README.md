# TConnect Store v2.0

A modern e-commerce platform for gift cards and cryptocurrency purchases.

## Features

- **Gift Cards**: Categorized gift cards across Gaming, Entertainment, Retail, Food & Dining, Travel, and Streaming
- **Cryptocurrency**: Buy and sell major cryptocurrencies with real-time pricing
- **Shopping Cart**: Full cart functionality with quantity management
- **Responsive Design**: Modern, mobile-first design with Tailwind CSS
- **TypeScript**: Type-safe development with React and TypeScript

## Categories

### Gift Cards
- Gaming (Steam, PlayStation, Xbox, Nintendo, Epic Games)
- Entertainment (Netflix, Spotify, Disney+, HBO Max)
- Retail (Amazon, Apple Store, Google Play, Walmart)
- Food & Dining (Starbucks, McDonald's, Uber Eats)
- Travel (Uber, Airbnb, Booking.com)
- Streaming (YouTube Premium, Twitch)

### Cryptocurrency
- Bitcoin (BTC)
- Ethereum (ETH)
- Binance Coin (BNB)
- Cardano (ADA)
- Solana (SOL)
- Polkadot (DOT)
- Chainlink (LINK)
- Litecoin (LTC)
- Bitcoin Cash (BCH)
- Dogecoin (DOGE)

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm build` - Builds the app for production
- `npm test` - Launches the test runner
- `npm eject` - Ejects from Create React App (one-way operation)

## Technologies Used

- React 18
- TypeScript
- React Router DOM
- Tailwind CSS
- Lucide React (Icons)
- Context API (State Management)

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Header.tsx
│   └── Footer.tsx
├── context/            # React Context for state management
│   └── CartContext.tsx
├── pages/              # Page components
│   ├── Home.tsx
│   ├── GiftCards.tsx
│   ├── Crypto.tsx
│   └── Cart.tsx
├── App.tsx             # Main app component
├── index.tsx           # App entry point
└── index.css           # Global styles
```

## Security Features

- 256-bit SSL encryption
- Secure payment processing
- No storage of sensitive data
- Instant digital delivery

## Future Enhancements

- User authentication and accounts
- Order history and tracking
- Payment gateway integration
- Real-time cryptocurrency pricing
- Advanced filtering and search
- Mobile app development
