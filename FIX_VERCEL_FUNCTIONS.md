# 🔧 Fix: Too Many Serverless Functions Error

## The Problem:
Vercel is trying to create a serverless function for each file in `api/` folder, exceeding the 12 function limit on Hobby plan.

## The Solution:
We need to tell Vercel to ONLY use `api/[...path].ts` as a serverless function, and ignore the routes folder.

## Fix: Update vercel.json

Add this to exclude routes from being treated as functions:

```json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "build",
  "framework": "create-react-app",
  "functions": {
    "api/[...path].ts": {
      "runtime": "@vercel/node"
    }
  },
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/[...path]"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

The key is the `functions` section - it tells Vercel to ONLY treat `api/[...path].ts` as a serverless function.

