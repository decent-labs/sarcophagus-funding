// We import Chai to use its asserting functions here.
const { expect } = require("chai");
const { network } = require("hardhat");
require('dotenv').config();
const Sarcoabi = require('./contractabi/SarcoABI.json');
const USDCabi = require('./contractabi/USDCABI.json');
const GeneralVestingabi = require('./contractabi/GeneralTokenVestingABI.json');
const { calculateUsdcSarcoRate } = require('../helpers');

describe("Purchase Executor Contract", function () {
    let PurchaseExecutor;
    let PurchaseExecutorDeployed;
    let SarcoToken;
    let SarcoTokenContract;
    let USDCToken;
    let SarcoTokenHolder;
    let USDCTokenHolder1;
    let USDCTokenHolder2;
    let USDCTokenHolder3;
    let GeneralTokenVesting;
    let owner, stranger;
    let SarcoDao;
    let SarcoVault;

    beforeEach(async function () {
        // Reset fork
        await network.provider.request({
            method: "hardhat_reset",
            params: [{
                forking: {
                    jsonRpcUrl: process.env.MAINNET_PROVIDER,
                    blockNumber: 12778138,
                }
            }]
        })

        // Impersonate Sarco holder + USDC holders
        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x244265a76901b8030b140a2996e6dd4703cbf20f"]
        }); // SarcoToken holder
        SarcoTokenHolder = await ethers.provider.getSigner("0x244265a76901b8030b140a2996e6dd4703cbf20f");

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xd6216fc19db775df9774a6e33526131da7d19a2c"]
        }); // USDCTokenHolder1 holder
        USDCTokenHolder1 = await ethers.provider.getSigner("0xd6216fc19db775df9774a6e33526131da7d19a2c");

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0xf9706224f8b7275ee159866c35f26e1f43682e20"]
        }); // USDCTokenHolder2 holder
        USDCTokenHolder2 = await ethers.provider.getSigner("0xf9706224f8b7275ee159866c35f26e1f43682e20");

        await hre.network.provider.request({
            method: "hardhat_impersonateAccount",
            params: ["0x530e0a6993ea99ffc96615af43f327225a5fe536"]
        }); // USDCTokenHolder3 holder
        USDCTokenHolder3 = await ethers.provider.getSigner("0x530e0a6993ea99ffc96615af43f327225a5fe536");

        // Get Signers
        [owner, stranger] = await ethers.getSigners();

        // Set Addresses
        SarcoToken = "0x7697b462a7c4ff5f8b55bdbc2f4076c2af9cf51a";
        SarcoDao = "0x3299f6a52983ba00FfaA0D8c2D5075ca3F3b7991";
        SarcoVault = "0x2627e4c6beecbcb7ba0a5bb9861ec870dc86eb59";
        USDCToken = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        GeneralTokenVesting = "0x8727c592F28F10b42eB0914a7f6a5885823794c0";

        // Set Contract Instances
        SarcoTokenContract = new ethers.Contract(SarcoToken, Sarcoabi, owner);
        USDCTokenContract = new ethers.Contract(USDCToken, USDCabi, owner);
        GeneralTokenVestingContract = new ethers.Contract(GeneralTokenVesting, GeneralVestingabi, owner);

        // Get the ContractFactory
        PurchaseExecutor = await ethers.getContractFactory("PurchaseExecutor");
    });

    describe("Deployment", function () {
        it("Should set constants", async function () {
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );
            expect(await PurchaseExecutorDeployed.usdc_to_sarco_rate()).to.equal(ethers.utils.parseUnits("1.0", 18));
            expect(await PurchaseExecutorDeployed.sarco_allocations_total()).to.equal(ethers.utils.parseUnits("360.0", 18));
            expect(await PurchaseExecutorDeployed.sarco_allocations(USDCTokenHolder1._address)).to.equal(ethers.utils.parseUnits("110.0", 18));
            expect(await PurchaseExecutorDeployed.sarco_allocations(USDCTokenHolder2._address)).to.equal(ethers.utils.parseUnits("120.0", 18));
            expect(await PurchaseExecutorDeployed.sarco_allocations(USDCTokenHolder3._address)).to.equal(ethers.utils.parseUnits("130.0", 18));
            expect(await PurchaseExecutorDeployed.vesting_end_delay()).to.equal(100);
            expect(await PurchaseExecutorDeployed.offer_expiration_delay()).to.equal(1000);
        });

        it("Should revert if usdc_to_sarco_rate rate is 0", async function () {
            await expect(PurchaseExecutor.deploy(
                0, // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            )).to.be.revertedWith("PurchaseExecutor: _usdc_to_sarco_rate must be greater than 0");
        });

        it("Should revert if vesting_end_delay is 0", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                0, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            )).to.be.revertedWith("PurchaseExecutor: end_delay must be greater than 0");
        });

        it("Should revert if offer_expiration_delay is 0", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                0,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            )).to.be.revertedWith("PurchaseExecutor: offer_expiration must be greater than 0");
        });

        it("Should revert if the length of purchaser array does not equal allocations array", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            )).to.be.revertedWith("PurchaseExecutor: purchasers and allocations lengths must be equal");
        });

        it("Should revert if the length of allocations array does not equal purchasers", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: purchasers and allocations lengths must be equal");
        });

        it("Should revert if the USDCToken address is address(0)", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                ethers.constants.AddressZero,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: _usdc_token cannot be 0 address");
        });

        it("Should revert if the SarcoToken address is address(0)", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                ethers.constants.AddressZero,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: _sarco_token cannot be 0 address");
        });

        it("Should revert if the GeneralTokenVesting address is address(0)", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                ethers.constants.AddressZero,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: _general_token_vesting cannot be 0 address");
        });

        it("Should revert if the SarcoDao is address(0)", async function () {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                ethers.constants.AddressZero))
                .to.be.revertedWith("PurchaseExecutor: _sarco_dao cannot be 0 address");
        });

        it("Should revert if a purchaser is zero address", async () => {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [ethers.constants.AddressZero, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: Purchaser cannot be the ZERO address");
        });

        it("Should revert if a purchaser allocation is zero", async () => {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [0, ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: No allocated Sarco tokens for address");
        });

        it("Should revert if purchaser array includes a duplicate", async () => {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder2._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: Allocation has already been set");
        });

        it("Should revert if _sarco_allocations_total does not equal sum of allocations array", async () => {
            await expect(PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("350.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao))
                .to.be.revertedWith("PurchaseExecutor: Allocations_total does not equal the sum of passed allocations");
        });

        it("Should approve SarcoDao total USDC", async () => {
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao);

            expect(await USDCTokenContract.connect(USDCTokenHolder1).allowance(PurchaseExecutorDeployed.address, SarcoDao))
                .to.equal(ethers.utils.parseUnits("360.0", 6));
        });

        it("Should approve SarcoDao total SARCO", async () => {
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao);

            expect(await SarcoTokenContract.connect(USDCTokenHolder1).allowance(PurchaseExecutorDeployed.address, SarcoDao))
                .to.equal(ethers.utils.parseUnits("360.0", 18));
        });
    });

    describe("Start", function () {
        beforeEach(async function () {
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );
        });

        it("Should revert if contract does not own allocated funds", async function () {
            await expect(PurchaseExecutorDeployed.start())
                .to.be.revertedWith("PurchaseExecutor: Insufficient Sarco contract balance to start offer");
        });

        it("Should emit OfferStarted event", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await expect(PurchaseExecutorDeployed.start())
                .to.emit(PurchaseExecutorDeployed, "OfferStarted");
        });

        it("Should emit OfferStarted event if offer the offer has not started before the first purchase executed", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Return USDCCost to purchase Sarco
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase - Listen for OfferStarted event
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address))
                .to.emit(PurchaseExecutorDeployed, "OfferStarted");
        });

        it("Should be callable from any EOA", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer (Stranger)
            await expect(PurchaseExecutorDeployed.connect(stranger).start())
                .to.emit(PurchaseExecutorDeployed, "OfferStarted");
        });

        it("offer_started should return false before start", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));
            expect(await PurchaseExecutorDeployed.offer_started()).to.be.equal(false);
        });

        it("offer_started should return true", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();
            expect(await PurchaseExecutorDeployed.offer_started()).to.be.equal(true);
        });

        it("offer_expired should return false before offer expires", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();

            // Increase Time to 1 second before the offer ends
            await network.provider.send("evm_increaseTime", [800]);
            await network.provider.send("evm_mine");
            expect(await PurchaseExecutorDeployed.offer_expired()).to.be.equal(false);
        });

        it("offer_expired should return true", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();


            // Increase Time to past offer ends
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");
            expect(await PurchaseExecutorDeployed.offer_expired()).to.be.equal(true);
        });

        it("Should revert if start is called twice", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();

            // Try to start offer twice
            await expect(PurchaseExecutorDeployed.start())
                .to.be.revertedWith("PurchaseExecutor: Offer has already started");
        });
    });

    describe("Execute Purchase", function () {
        beforeEach(async function () {
            // Deploy contract
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18)],
                ethers.utils.parseUnits("230.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );

            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("230.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();
        });

        it("Should revert since offer has expired", async function () {
            // Increase Time to past offer expired
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");

            // Try to execute a purchase
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address))
                .to.be.revertedWith("PurchaseExecutor: Purchases cannot be made after the offer has expired");
        });

        it("Should revert since the Purchaser does not have an allocation", async function () {
            await expect(PurchaseExecutorDeployed.connect(owner).execute_purchase(owner.address))
                .to.be.revertedWith("PurchaseExecutor: sender does not have a SARCO allocation");
        });

        it("Should revert since the Purchaser did not approve PurchaseExecutor for purchase", async function () {
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address))
                .to.be.revertedWith("ERC20: transfer amount exceeds allowance");
        });

        it("Should emit PurchaseExecuted event", async function () {
            // Return USDCCost to purchase Sarco 
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address))
                .to.emit(PurchaseExecutorDeployed, "PurchaseExecuted");
        });

        it("Should not be able to purchase on the behalf of another user", async function () {
            // Return USDCCost to purchase Sarco 
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder3).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase onBehalf of a whitelisted Purchaser
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder3).execute_purchase(USDCTokenHolder1._address))
                .to.be.revertedWith("PurchaseExecutor: sender does not have a SARCO allocation");
        });

        it("should allow purchaser to assign SARCO to another address", async function () {
            let SarcoAllocation, USDCCost
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase on Behalf of a whitelisted Purchaser, assigning SARCO to another address
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(stranger.address);

            // verify that the SARCO is in token vesting, on behalf of third party address
            expect(await GeneralTokenVestingContract.getTotalTokens(SarcoToken, stranger.address)).to.eq(SarcoAllocation);
        });

        it("Should revert if you attempt to purchase twice", async function () {
            // Return USDCCost to purchase Sarco 
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Purchase 1
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Purchase 2
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address))
                .to.be.revertedWith("PurchaseExecutor: sender does not have a SARCO allocation");
        });

        it("Should update Sarco DAO USDC Balance", async function () {
            // Check USDC Balance of SarcoVault before a purchase
            beforeTransfer = await USDCTokenContract.balanceOf(SarcoVault);

            // Return USDCCost to purchase Sarco 
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Check GeneralTokenVesting Balance after a purchase
            afterTransfer = await USDCTokenContract.balanceOf(SarcoVault);

            // Check Vault USDC Balance after purchase
            expect(afterTransfer.sub(beforeTransfer)).to.equal(USDCCost);
        });

        it("Should update GeneralTokenVesting Sarco Balance", async function () {
            // Check Sarco Balance of GeneralTokenVesting before a purchase
            beforeTransfer = await SarcoTokenContract.balanceOf(GeneralTokenVesting);

            // Return USDCCost to purchase Sarco 
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Check GeneralTokenVesting Balance after a purchase
            afterTransfer = await SarcoTokenContract.balanceOf(GeneralTokenVesting);

            // General TokenVesting Balance should increase
            expect(afterTransfer.sub(beforeTransfer))
                .to.be.equal(ethers.utils.parseUnits("110.0", 18));
        });

        it("Should update GeneralTokenVesting contract state", async function () {
            // Return USDCCost to purchase Sarco 
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);

            // Approve PurchaseExecutor Contract the USDCCost amount
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Check whitelisted purchaser's vested tokens
            expect(await GeneralTokenVestingContract.getTotalTokens(SarcoToken, USDCTokenHolder1._address))
                .to.be.equal(ethers.utils.parseUnits("110.0", 18));

            // Check whitelisted purchaser vesting duration
            expect(await GeneralTokenVestingContract.getDuration(SarcoToken, USDCTokenHolder1._address))
                .to.be.equal(100);

        });
    });

    describe("Verify usdc_to_sarco conversion rates", function () {
        const deployAndGetCost = async (numberOfSarco, usdcPricePerSarco) => {
            const rate = calculateUsdcSarcoRate(usdcPricePerSarco)
            
            // Deploy Contract
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                rate, // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address],
                [numberOfSarco],
                numberOfSarco,
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );

            // Return USDCCost to purchase Sarco
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);
            return USDCCost;
        }

        it("Should verify purchasing 12,345 SARCO at a rate of $1 per SARCO costs $12,345", async function () {
            const numberOfSarco = ethers.utils.parseUnits("12345", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("1", 6);
            const expectedCost = ethers.utils.parseUnits("12345", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });

        it("Should verify purchasing 110,000 SARCO at a rate of 20 cents per SARCO costs $22,000", async function () {
            const numberOfSarco = ethers.utils.parseUnits("110000", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("0.2", 6);
            const expectedCost = ethers.utils.parseUnits("22000", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });

        it("Should verify purchasing 20,000 SARCO at a rate of 25 cents per SARCO costs $5,000", async function () {
            const numberOfSarco = ethers.utils.parseUnits("20000", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("0.25", 6);
            const expectedCost = ethers.utils.parseUnits("5000", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });

        it("Should verify purchasing 1,500 SARCO at a rate of 66 cents per SARCO costs $990", async function () {
            const numberOfSarco = ethers.utils.parseUnits("1500", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("0.66", 6);
            const expectedCost = ethers.utils.parseUnits("990", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });

        it("Should verify purchasing 121 SARCO at a rate of 92 cents per SARCO costs $111.32", async function () {
            const numberOfSarco = ethers.utils.parseUnits("121", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("0.92", 6);
            const expectedCost = ethers.utils.parseUnits("111.32", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });

        it("Should verify purchasing 25 SARCO at a rate of $1.50 per SARCO costs $37.50", async function () {
            const numberOfSarco = ethers.utils.parseUnits("25", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("1.50", 6);
            const expectedCost = ethers.utils.parseUnits("37.5", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });

        it("Should verify purchasing 1000 SARCO at a rate of $4.20 per SARCO costs $4200", async function () {
            const numberOfSarco = ethers.utils.parseUnits("1000", 18);
            const usdcPricePerSarco = ethers.utils.parseUnits("4.20", 6);
            const expectedCost = ethers.utils.parseUnits("4200", 6);
            const contractCost = await deployAndGetCost(numberOfSarco, usdcPricePerSarco);

            expect(contractCost).to.equal(expectedCost);
        });
    });

    describe("Recover Unused Tokens", function () {
        beforeEach(async function () {
            // Deploy Contract
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );
        });

        it("Should revert - offer not started", async function () {
            await expect(PurchaseExecutorDeployed.recover_unsold_tokens())
                .to.be.revertedWith("PurchaseExecutor: Purchase offer has not yet started");
        });

        it("Should revert - offer not expired", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();

            // Try to recover unsold tokens
            await expect(PurchaseExecutorDeployed.recover_unsold_tokens())
                .to.be.revertedWith("PurchaseExecutor: Purchase offer has not yet expired");
        });

        it("Should revert if there are no tokens to recover", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();

            // Return USDCCost to purchase Sarco
            let SarcoAllocation;
            let USDCCost;

            // Purchaser 1
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Purchaser 2
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder2._address);
            await USDCTokenContract.connect(USDCTokenHolder2).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder2).execute_purchase(USDCTokenHolder2._address);

            // Purchaser 3
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder3._address);
            await USDCTokenContract.connect(USDCTokenHolder3).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder3).execute_purchase(USDCTokenHolder3._address);

            // Increase Time to past offer expired
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");

            // Try to recover unsold tokens
            await expect(PurchaseExecutorDeployed.recover_unsold_tokens())
                .to.be.revertedWith("PurchaseExecutor: There are no Sarco tokens to recover");
        });

        it("Should emit TokensRecovered event", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();

            // Increase Time to past offer expired
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");

            // Recover unsold tokens
            await expect(PurchaseExecutorDeployed.recover_unsold_tokens())
                .to.emit(PurchaseExecutorDeployed, "TokensRecovered");
        });

        it("Should update DAO Balance", async function () {
            // Transfer Sarco to PurchaseExecutor Contract
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));

            // Start Offer
            await PurchaseExecutorDeployed.start();

            // Increase Time to past offer expired
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");

            // Recover unsold tokens
            beforeTransfer = await SarcoTokenContract.balanceOf(SarcoVault);
            await PurchaseExecutorDeployed.recover_unsold_tokens();
            afterTransfer = await SarcoTokenContract.balanceOf(SarcoVault);

            // Check Purchase Executor Balance
            expect(afterTransfer.sub(beforeTransfer))
                .to.be.equal(ethers.utils.parseUnits("360.0", 18));
            expect(await SarcoTokenContract.connect(SarcoTokenHolder).balanceOf(PurchaseExecutorDeployed.address))
                .to.equal(0);
        });
    });

    describe("Integration Tests", function () {
        it("Should Deploy - Start - Execute Purchase - Recover Funds", async function () {
            // Deployed
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );

            // Start Offer
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));
            await expect(PurchaseExecutorDeployed.start())
                .to.emit(PurchaseExecutorDeployed, "OfferStarted");

            // Purchase Executed
            let SarcoAllocation;
            let USDCCost;
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);

            // Execute Purchase
            await expect(PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address))
                .to.emit(PurchaseExecutorDeployed, "PurchaseExecuted");

            // Increase Time to past offer expired
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");

            // Recover Unused Funds
            await expect(PurchaseExecutorDeployed.recover_unsold_tokens())
                .to.emit(PurchaseExecutorDeployed, "TokensRecovered");
        });

        it("Should Deploy - Start - Execute (3)Purchase - Revert Recover Funds", async function () {
            // Deployed
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );

            // Offer Started
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));
            await expect(PurchaseExecutorDeployed.start())
                .to.emit(PurchaseExecutorDeployed, "OfferStarted");

            // Return USDCCost to purchase Sarco
            let SarcoAllocation;
            let USDCCost;

            // Purchaser 1
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Purchaser 2
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder2._address);
            await USDCTokenContract.connect(USDCTokenHolder2).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder2).execute_purchase(USDCTokenHolder2._address);

            // Purchaser 3
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder3._address);
            await USDCTokenContract.connect(USDCTokenHolder3).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder3).execute_purchase(USDCTokenHolder3._address);

            // Increase Time to past offer expired
            await network.provider.send("evm_increaseTime", [1000]);
            await network.provider.send("evm_mine");

            // Recover Unused Funds
            await expect(PurchaseExecutorDeployed.recover_unsold_tokens())
                .to.be.revertedWith("PurchaseExecutor: There are no Sarco tokens to recover");
        });

        it("Should Deploy - Start - Execute (3)Purchase - Verify GeneralVesting/Purchase Executor state", async function () {
            // Deployed
            PurchaseExecutorDeployed = await PurchaseExecutor.deploy(
                ethers.utils.parseUnits("1.0", 18), // usdc_to_sarco_rate
                100, // vesting duration
                1000,// offer expiration delay
                [USDCTokenHolder1._address, USDCTokenHolder2._address, USDCTokenHolder3._address],
                [ethers.utils.parseUnits("110.0", 18), ethers.utils.parseUnits("120.0", 18), ethers.utils.parseUnits("130.0", 18)],
                ethers.utils.parseUnits("360.0", 18),
                USDCToken,
                SarcoToken,
                GeneralTokenVesting,
                SarcoDao
            );

            // Offer Started
            await SarcoTokenContract.connect(SarcoTokenHolder).transfer(PurchaseExecutorDeployed.address, ethers.utils.parseUnits("360.0", 18));
            await expect(PurchaseExecutorDeployed.start())
                .to.emit(PurchaseExecutorDeployed, "OfferStarted");

            // Return USDCCost to purchase Sarco
            let SarcoAllocation;
            let USDCCost;

            // Purchaser 1
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.connect(USDCTokenHolder1).get_allocation(USDCTokenHolder1._address);
            await USDCTokenContract.connect(USDCTokenHolder1).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder1).execute_purchase(USDCTokenHolder1._address);

            // Purchaser 2
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.connect(USDCTokenHolder2).get_allocation(USDCTokenHolder2._address);
            await USDCTokenContract.connect(USDCTokenHolder2).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder2).execute_purchase(USDCTokenHolder2._address);

            // Purchaser 3
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.connect(USDCTokenHolder3).get_allocation(USDCTokenHolder3._address);
            await USDCTokenContract.connect(USDCTokenHolder3).approve(PurchaseExecutorDeployed.address, USDCCost);
            await PurchaseExecutorDeployed.connect(USDCTokenHolder3).execute_purchase(USDCTokenHolder3._address);

            // Purchase Executor: Allocations Should be 0
            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder1._address);
            expect(SarcoAllocation).to.equal(0);

            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder2._address);
            expect(SarcoAllocation).to.equal(0);

            [SarcoAllocation, USDCCost] = await PurchaseExecutorDeployed.get_allocation(USDCTokenHolder3._address);
            expect(SarcoAllocation).to.equal(0);

            // GeneralTokenVesting: Durations/TotalTokens > 0
            expect(await GeneralTokenVestingContract.getTotalTokens(SarcoToken, USDCTokenHolder1._address))
                .to.be.equal(ethers.utils.parseUnits("110.0", 18));
            // Check purchaser vesting duration
            expect(await GeneralTokenVestingContract.getDuration(SarcoToken, USDCTokenHolder1._address))
                .to.be.equal(100);

            expect(await GeneralTokenVestingContract.getTotalTokens(SarcoToken, USDCTokenHolder2._address))
                .to.be.equal(ethers.utils.parseUnits("120.0", 18));
            // Check purchaser vesting duration
            expect(await GeneralTokenVestingContract.getDuration(SarcoToken, USDCTokenHolder2._address))
                .to.be.equal(100);

            expect(await GeneralTokenVestingContract.getTotalTokens(SarcoToken, USDCTokenHolder3._address))
                .to.be.equal(ethers.utils.parseUnits("130.0", 18));
            // Check purchaser vesting duration
            expect(await GeneralTokenVestingContract.getDuration(SarcoToken, USDCTokenHolder3._address))
                .to.be.equal(100);
        });
    });
});