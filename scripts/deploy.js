// Deploys Seed2StoreNFT (crop certificates + auctions + direct purchase) and wires it into .env.local.
//
//   Local:    npm run chain   (terminal 1)   then   npm run deploy:local
//   Sepolia:  put DEPLOYER_PRIVATE_KEY (a funded testnet key) in .env.local, then npm run deploy:sepolia
//
const hre = require("hardhat")
const fs = require("fs")
const path = require("path")

const SEPOLIA = 11155111
// Testnet ETH comes from faucets in small amounts, so on Sepolia lots are priced at a demo rate:
// $67,200 ≈ 0.013 ETH. Mainnet-like behaviour (2500 USD/ETH) stays the default everywhere else.
const TESTNET_ETH_USD = 5_000_000

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
  if (!deployer) throw new Error("No deployer account. Set DEPLOYER_PRIVATE_KEY in .env.local for this network.")
  const network = await hre.ethers.provider.getNetwork()
  const chainId = Number(network.chainId)
  const balance = await hre.ethers.provider.getBalance(deployer.address)

  console.log(`\nDeploying Seed2StoreNFT to ${hre.network.name} (chain ${chainId})`)
  console.log(`  deployer  ${deployer.address}`)
  console.log(`  balance   ${hre.ethers.formatEther(balance)} ETH`)
  if (balance === 0n) throw new Error(`The deployer has no ETH on ${hre.network.name}. Fund ${deployer.address} first.`)

  const Factory = await hre.ethers.getContractFactory("Seed2StoreNFT")
  const nft = await Factory.deploy()
  const tx = nft.deploymentTransaction()
  console.log(`  tx        ${tx && tx.hash}  (waiting to be mined…)`)
  await nft.waitForDeployment()
  const address = await nft.getAddress()
  const receipt = tx ? await tx.wait() : null
  const deployBlock = receipt ? receipt.blockNumber : 0

  console.log(`  contract  ${address}`)
  console.log(`  block     ${deployBlock}`)

  const deploymentsDir = path.join(__dirname, "..", "deployments")
  fs.mkdirSync(deploymentsDir, { recursive: true })
  fs.writeFileSync(
    path.join(deploymentsDir, `${hre.network.name}.json`),
    JSON.stringify(
      {
        network: hre.network.name,
        chainId,
        deployer: deployer.address,
        Seed2StoreNFT: { address, transactionHash: tx && tx.hash, blockNumber: deployBlock },
        deployedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  )

  const isSepolia = chainId === SEPOLIA
  const rpcUrl = hre.network.config.url || "http://127.0.0.1:8545"
  upsertEnv(path.join(__dirname, "..", ".env.local"), {
    NEXT_PUBLIC_CHAIN_ID: chainId,
    NEXT_PUBLIC_RPC_URL: rpcUrl,
    NEXT_PUBLIC_NFT_CONTRACT: address,
    NEXT_PUBLIC_DEPLOY_BLOCK: deployBlock,
    ...(isSepolia
      ? { NEXT_PUBLIC_CHAIN_NAME: "Sepolia", NEXT_PUBLIC_EXPLORER_URL: "https://sepolia.etherscan.io", NEXT_PUBLIC_ETH_USD: TESTNET_ETH_USD }
      : {}),
  })
  console.log(`\n.env.local updated (contract, chain, RPC, deploy block${isSepolia ? ", explorer, testnet price rate" : ""}).`)

  if (isSepolia) {
    console.log(`\nEtherscan: https://sepolia.etherscan.io/address/${address}`)
    console.log("Verifying source on Sourcify/Etherscan (waiting for a few confirmations)…")
    try {
      await tx.wait(5)
      await hre.run("verify:verify", { address, constructorArguments: [] })
      console.log("✓ Source verified")
    } catch (e) {
      console.log(`Verification skipped: ${e.message.split("\n")[0]}`)
    }
  }
  console.log(`\nRestart \`npm run dev\` so Next.js picks up the new contract.\n`)
}

main().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
