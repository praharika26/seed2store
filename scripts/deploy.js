// Deploys Seed2StoreNFT (crop certificates + auctions + direct purchase) and wires it into .env.local.
//
//   npm run chain          # terminal 1: local Hardhat node on :8545
//   npm run deploy:local   # terminal 2
//
const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

function upsertEnv(file, entries) {
  let text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : ""
  for (const [key, value] of Object.entries(entries)) {
    const line = `${key}=${value}`
    const re = new RegExp(`^${key}=.*$`, "m")
    text = re.test(text) ? text.replace(re, line) : `${text}${text && !text.endsWith("\n") ? "\n" : ""}${line}\n`
  }
  fs.writeFileSync(file, text)
}

async function main() {
  const [deployer] = await hre.ethers.getSigners()
  const network = await hre.ethers.provider.getNetwork()
  const chainId = Number(network.chainId)
  const balance = await hre.ethers.provider.getBalance(deployer.address)

  console.log(`\nDeploying Seed2StoreNFT to ${hre.network.name} (chain ${chainId})`)
  console.log(`  deployer  ${deployer.address}`)
  console.log(`  balance   ${hre.ethers.formatEther(balance)} ETH`)

  const Factory = await hre.ethers.getContractFactory("Seed2StoreNFT")
  const nft = await Factory.deploy()
  await nft.waitForDeployment()
  const address = await nft.getAddress()
  const tx = nft.deploymentTransaction()

  console.log(`  contract  ${address}`)

  const deploymentsDir = path.join(__dirname, "..", "deployments")
  fs.mkdirSync(deploymentsDir, { recursive: true })
  fs.writeFileSync(
    path.join(deploymentsDir, `${hre.network.name}.json`),
    JSON.stringify(
      {
        network: hre.network.name,
        chainId,
        deployer: deployer.address,
        Seed2StoreNFT: { address, transactionHash: tx && tx.hash },
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  const rpcUrl = hre.network.config.url || "http://127.0.0.1:8545"
  upsertEnv(path.join(__dirname, "..", ".env.local"), {
    NEXT_PUBLIC_CHAIN_ID: chainId,
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_NFT_CONTRACT: address,
  })

  console.log(`\n.env.local updated (NEXT_PUBLIC_NFT_CONTRACT, NEXT_PUBLIC_CHAIN_ID, NEXT_PUBLIC_RPC_URL).`)
  console.log(`Restart \`npm run dev\` so Next.js picks up the new contract address.\n`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
