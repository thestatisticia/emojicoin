const hre = require("hardhat");

async function main() {
    console.log("Deploying TokenFactory to QIE Network...");

    const factory = await hre.ethers.deployContract("TokenFactory");

    await factory.waitForDeployment();

    console.log(`TokenFactory deployed to ${factory.target}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
