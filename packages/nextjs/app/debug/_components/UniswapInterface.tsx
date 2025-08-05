"use client";

import React, { useEffect, useState } from "react";
import { IUniswapV2 } from "./IUniswapV2";
import { ethers } from "ethers";

interface FormState {
  token0: string;
  token1: string;
  feeTo: string;
  to: string;
  amount0Out: string;
  amount1Out: string;
  amount: string;
  spender: string;
  from: string;
  address: string;
  owner: string;
  tokenAddress: string;
}

interface FormsState {
  initialize: Pick<FormState, "token0" | "token1" | "feeTo">;
  mint: Pick<FormState, "to">;
  burn: Pick<FormState, "to">;
  swap: Pick<FormState, "amount0Out" | "amount1Out" | "to">;
  transfer: Pick<FormState, "to" | "amount">;
  approve: {
    token0Amount: string;
    token1Amount: string;
    spender: string;
    tokenAddress: string;
  };
  transferFrom: Pick<FormState, "from" | "to" | "amount">;
  balanceCheck: Pick<FormState, "address" | "tokenAddress">;
  allowanceCheck: Pick<FormState, "owner" | "spender" | "tokenAddress">;
}

interface TransactionArgs {
  initialize: [string, string, string, { gasLimit?: number }?] | any;
  mint: [string, { gasLimit?: number }?];
  burn: [string, { gasLimit?: number }?];
  swap: [number, number, string, any[], { gasLimit?: number }?] | any;
  transfer: [string, number, { gasLimit?: number }?] | any;
  approve: [string, number, { gasLimit?: number }?] | any;
  transferFrom: [string, string, number, { gasLimit?: number }?] | any;
}

// Tab type for better organization
const TABS = {
  INFO: "Contract Info",
  LIQUIDITY: "Liquidity Operations",
  TRANSFERS: "Token Transfers",
  ALLOWANCES: "Allowances",
} as const;

export default function UniswapInterface() {
  // Contract connection states
  const [contract, setContract] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<any>(TABS.INFO);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deployedTokens, setDeployedTokens] = useState<{ token0: string, token1: string }>({
    token0: "",
    token1: ""
  });
  const [poolInitialized, setPoolInitialized] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Contract info states
  const [contractInfo, setContractInfo] = useState({
    name: "",
    symbol: "",
    decimals: "",
    totalSupply: "",
    address: "",
  });

  // Form states
  const [forms, setForms] = useState({
    initialize: { token0: "", token1: "", feeTo: "" },
    mint: { to: "" },
    burn: { to: "" },
    swap: { amount0Out: "", amount1Out: "", to: "" },
    transfer: { to: "", amount: "" },
    approve: { token0Amount: "", token1Amount: "", spender: "", tokenAddress: "" },
    transferFrom: { from: "", to: "", amount: "" },
    balanceCheck: { address: "", tokenAddress: "" },
    allowanceCheck: { owner: "", spender: "", tokenAddress: "" },
  });

  // Results states
  const [results, setResults] = useState({
    balance: "",
    allowance: "",
  });

  // Transaction status state
  const [txStatus, setTxStatus] = useState<{
    status: "none" | "pending" | "success" | "error";
    message: string;
    operation?: string;
  }>({ status: "none", message: "" });

  // Add state to track completion of steps
  const [stepsCompleted, setStepsCompleted] = useState<{
    [key: number]: boolean;
  }>({
    1: false,
    2: false,
    3: false,
    4: false
  });

  // Add additional state for debug info and token balances
  const [debugInfo, setDebugInfo] = useState({
    token0Balance: "",
    token1Balance: "",
    token0Allowance: "",
    token1Allowance: "",
    lpTokenBalance: "",
    rawLpBalance: "",
    lastError: ""
  });

  useEffect(() => {
    initializeContract();
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // Add localStorage persistence for steps and token addresses - modified to happen earlier
  useEffect(() => {
    // Check localStorage for saved state
    try {
      const savedStep = localStorage.getItem('currentStep');
      const savedTokens = localStorage.getItem('deployedTokens');
      const savedStepsCompleted = localStorage.getItem('stepsCompleted');
      const savedPoolInitialized = localStorage.getItem('poolInitialized');

      if (savedStep) {
        const step = parseInt(savedStep);
        setCurrentStep(step);
      }

      if (savedTokens) {
        const tokens = JSON.parse(savedTokens);
        setDeployedTokens(tokens);
        // Also update the initialize form with these tokens
        setForms(prev => ({
          ...prev,
          initialize: {
            ...prev.initialize,
            token0: tokens.token0,
            token1: tokens.token1
          }
        }));
      }

      if (savedStepsCompleted) {
        setStepsCompleted(JSON.parse(savedStepsCompleted));
      }

      if (savedPoolInitialized === 'true') {
        setPoolInitialized(true);
      }
    } catch (error) {
      console.error("Error loading state from localStorage:", error);
    }

    // Only initialize contract after loading from localStorage
    initializeContract();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update localStorage when state changes
  useEffect(() => {
    try {
      localStorage.setItem('currentStep', currentStep.toString());
      localStorage.setItem('deployedTokens', JSON.stringify(deployedTokens));
      localStorage.setItem('stepsCompleted', JSON.stringify(stepsCompleted));
      localStorage.setItem('poolInitialized', poolInitialized.toString());
    } catch (error) {
      console.error("Error saving state to localStorage:", error);
    }
  }, [currentStep, deployedTokens, stepsCompleted, poolInitialized]);

  const initializeContract = async () => {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
      const signer = new ethers.Wallet(privateKey, provider);
      const signerAddress = await signer.getAddress();
      const uniswapContractAddress = "0x642d01f3b2c36d7f8dee3e0822b4304c43ddbd35";
      const uniswapContract = new ethers.Contract(uniswapContractAddress, IUniswapV2, signer);
      console.log("contract", uniswapContract);
      setContract(uniswapContract);

      // Auto-populate the mint.to field with the signer's address
      setForms(prev => ({
        ...prev,
        mint: {
          ...prev.mint,
          to: signerAddress
        }
      }));

      // Don't reset token addresses if they're already loaded from localStorage
      if (!deployedTokens.token0 && !deployedTokens.token1) {
        setDeployedTokens({
          token0: "",
          token1: ""
        });
      }

      // Check if pool is already initialized by verifying token0 and token1
      try {
        const token0Addr = await uniswapContract.token0();
        const token1Addr = await uniswapContract.token1();

        if (token0Addr !== ethers.ZeroAddress && token1Addr !== ethers.ZeroAddress) {
          setPoolInitialized(true);
          setStepsCompleted(prev => ({ ...prev, 1: true }));

          // Load token addresses into state and form
          setDeployedTokens({ token0: token0Addr, token1: token1Addr });
          setForms(prev => ({
            ...prev,
            initialize: {
              ...prev.initialize,
              token0: token0Addr,
              token1: token1Addr
            }
          }));
          console.log("Token addresses fetched from contract:", { token0: token0Addr, token1: token1Addr });

          // Check allowances and LP token balance to determine which steps are completed
          const [token0Contract, token1Contract] = await Promise.all([
            new ethers.Contract(
              token0Addr,
              ["function allowance(address,address) view returns (uint256)"],
              provider
            ),
            new ethers.Contract(
              token1Addr,
              ["function allowance(address,address) view returns (uint256)"],
              provider
            )
          ]);

          // Check if tokens are approved (step 2)
          const [allowance0, allowance1] = await Promise.all([
            token0Contract.allowance(signerAddress, uniswapContractAddress),
            token1Contract.allowance(signerAddress, uniswapContractAddress)
          ]);

          if (allowance0 > 0n || allowance1 > 0n) {
            setStepsCompleted(prev => ({ ...prev, 2: true }));
            // If at least one token is approved, user has reached step 2
            if (currentStep < 2) setCurrentStep(2);
          }

          // Check LP token balance (step 3)
          const lpBalance = await uniswapContract.balanceOf(signerAddress);
          console.log("LP balance check:", ethers.formatUnits(lpBalance, 18));

          if (lpBalance > 0n) {
            // User has LP tokens, they've completed step 3
            setStepsCompleted(prev => ({ ...prev, 3: true }));
            if (currentStep < 3) setCurrentStep(3);
          }
        } else {
          console.log("Pool not initialized (token0 or token1 is zero)");
          setPoolInitialized(false);
          setCurrentStep(1);
        }
      } catch (error) {
        console.error("Error checking pool initialization:", error);
        setPoolInitialized(false);
        setCurrentStep(1);
      }

      await fetchContractInfo(uniswapContract);

      // Check balances and allowances if tokens are available
      if (deployedTokens.token0 && deployedTokens.token1) {
        await checkTokenBalancesAndAllowances();
      }

    } catch (err) {
      setTxStatus({
        status: "error",
        message: "Failed to initialize contract"
      });
      console.error(err);
    }
  };

  const fetchContractInfo = async (contract: any) => {
    try {
      const [name, symbol, decimals, totalSupply] = await Promise.all([
        contract.name(),
        contract.symbol(),
        contract.decimals(),
        contract.totalSupply(),
      ]);

      setContractInfo({
        name,
        symbol,
        decimals: decimals.toString(),
        totalSupply: ethers.formatEther(totalSupply),
        address: await contract.target,
      });
    } catch (err) {
      setTxStatus({
        status: "error",
        message: "Error fetching contract info"
      });
      console.error(err);
    }
  };

  const updateForm = (formName: keyof FormsState, field: string, value: string) => {
    setForms(prev => ({
      ...prev,
      [formName]: {
        ...prev[formName],
        [field]: value,
      },
    }));
  };

  const handleTransaction = async <T extends keyof TransactionArgs>(
    operation: T,
    pendingMessage: string,
    successMessage: string,
    ...args: TransactionArgs[T]
  ) => {
    // Don't proceed if another operation is pending
    if (txStatus.status === "pending") return;

    setTxStatus({
      status: "pending",
      message: pendingMessage,
      operation: operation
    });

    try {
      let tx;
      const options = args[args.length - 1] as { gasLimit?: number } | undefined;
      const txOptions = options && options.gasLimit ? { gasLimit: options.gasLimit } : { gasLimit: 10000000 };

      // Additional checks for mint operation
      if (operation === "mint") {
        // Check pool initialization first
        try {
          await checkPoolStatus();
        } catch (error: any) {
          setTxStatus({
            status: "error",
            message: "Pool not properly initialized. Please complete Step 1 first."
          });
          setDebugInfo(prev => ({
            ...prev,
            lastError: error.message || "Unknown pool initialization error"
          }));
          return;
        }

        // Check token balances and allowances before minting
        await checkTokenBalancesAndAllowances();

        // Validate or default the recipient address
        if (!args[0] || args[0] === "") {
          const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
          const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
          const signer = new ethers.Wallet(privateKey, provider);
          const signerAddress = await signer.getAddress();
          args[0] = signerAddress;

          // Also update the form
          setForms(prev => ({
            ...prev,
            mint: { ...prev.mint, to: signerAddress }
          }));

          console.log("Using default signer address for LP tokens:", signerAddress);
        }
      }

      switch (operation) {
        case "initialize":
          // Store token addresses before initialization
          if (args && args.length >= 2) {
            const token0 = args[0] as string;
            const token1 = args[1] as string;
            // Update deployedTokens right away - this ensures we have the addresses
            // even if the transaction fails
            setDeployedTokens({
              token0,
              token1
            });
          }
          tx = await contract.initialize(...args.slice(0, -1), txOptions);
          break;
        case "mint":
          tx = await contract.mint(...args.slice(0, -1), txOptions);
          break;
        case "burn":
          tx = await contract.burn(...args.slice(0, -1), txOptions);
          break;
        case "swap":
          tx = await contract.swap(...args.slice(0, -1), txOptions);
          break;
        case "transfer":
          tx = await contract.transfer(...args.slice(0, -1), txOptions);
          break;
        case "approve":
          tx = await contract.approve(...args.slice(0, -1), txOptions);
          break;
        case "transferFrom":
          tx = await contract.transferFrom(...args.slice(0, -1), txOptions);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }

      await tx.wait();
      setTxStatus({
        status: "success",
        message: successMessage
      });

      // Mark step as completed based on operation
      if (operation === "initialize") {
        setStepsCompleted(prev => ({ ...prev, 1: true }));
        setPoolInitialized(true);
        // Token addresses already stored above
      } else if (operation === "approve") {
        // For approve, we'll consider step 2 done when at least one token is approved
        setStepsCompleted(prev => ({ ...prev, 2: true }));
        // After approval, update the token allowance info
        await checkTokenBalancesAndAllowances();
      } else if (operation === "mint") {
        setStepsCompleted(prev => ({ ...prev, 3: true }));
        // After mint, update the token balance info
        await checkTokenBalancesAndAllowances();
      }

      await fetchContractInfo(contract);
    } catch (err: any) {
      const errorMessage = err.reason || err.message || "Transaction failed";
      setTxStatus({
        status: "error",
        message: errorMessage
      });
      console.error("Transaction error details:", err);

      // Store detailed error information for debugging
      setDebugInfo(prev => ({
        ...prev,
        lastError: JSON.stringify(err, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      }));
    }

    // Clear status after 5 seconds, but only for error states
    if (txStatus.status === "error") {
      setTimeout(() => {
        setTxStatus({ status: "none", message: "" });
      }, 5000);
    }
  };

  // Improve the checkTokenBalancesAndAllowances function
  const checkTokenBalancesAndAllowances = async () => {
    try {
      if (!deployedTokens.token0 || !deployedTokens.token1 || !contractInfo.address) {
        return;
      }

      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
      const signer = new ethers.Wallet(privateKey, provider);
      const signerAddress = await signer.getAddress();

      // Create token contract instances
      const token0Contract = new ethers.Contract(
        deployedTokens.token0,
        [
          "function balanceOf(address owner) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        signer
      );

      const token1Contract = new ethers.Contract(
        deployedTokens.token1,
        [
          "function balanceOf(address owner) view returns (uint256)",
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        signer
      );

      // Check LP token balance if pool has been initialized
      let lpBalance = "0.0";
      let lpSymbol = "LP";
      let rawLpBalanceWei = "0"; // Store the raw balance in wei
      try {
        if (contract && contract.target) {
          const lpDecimals = await contract.decimals() || 18;
          lpSymbol = await contract.symbol();
          const lpBalanceBN = await contract.balanceOf(signerAddress);
          console.log("LP balance raw:", lpBalanceBN.toString());
          
          // Store the raw balance
          rawLpBalanceWei = lpBalanceBN.toString();

          // Make sure we properly handle zero balances
          if (lpBalanceBN === 0n || lpBalanceBN === BigInt(0)) {
            lpBalance = "0.0";
            console.log("LP balance is zero");
          } else {
            // Format with full precision to show accurate small values
            lpBalance = ethers.formatUnits(lpBalanceBN, lpDecimals);
            console.log("LP balance formatted with full precision:", lpBalance);
            console.log("LP balance in wei:", lpBalanceBN.toString());

            // If LP tokens exist, mark step 3 as completed
            if (lpBalanceBN > 0n) {
              setStepsCompleted(prev => ({ ...prev, 3: true }));
            }
          }
        }
      } catch (err) {
        console.error("Error fetching LP token balance:", err);
        lpBalance = "Error fetching";
      }

      // Get balances and allowances
      const [
        token0Balance, token0Decimals, token0Symbol,
        token1Balance, token1Decimals, token1Symbol,
        token0Allowance, token1Allowance
      ] = await Promise.all([
        token0Contract.balanceOf(signerAddress),
        token0Contract.decimals(),
        token0Contract.symbol(),
        token1Contract.balanceOf(signerAddress),
        token1Contract.decimals(),
        token1Contract.symbol(),
        token0Contract.allowance(signerAddress, contractInfo.address),
        token1Contract.allowance(signerAddress, contractInfo.address)
      ]);

      // Update debug info
      setDebugInfo({
        token0Balance: `${ethers.formatUnits(token0Balance, token0Decimals)} ${token0Symbol}`,
        token1Balance: `${ethers.formatUnits(token1Balance, token1Decimals)} ${token1Symbol}`,
        token0Allowance: `${ethers.formatUnits(token0Allowance, token0Decimals)} ${token0Symbol}`,
        token1Allowance: `${ethers.formatUnits(token1Allowance, token1Decimals)} ${token1Symbol}`,
        lpTokenBalance: lpBalance ? `${lpBalance} ${lpSymbol}` : `0.0 ${lpSymbol}`,
        rawLpBalance: rawLpBalanceWei,
        lastError: ""
      });

      // Mark step 2 as completed if either token has allowance
      if (token0Allowance > 0n || token1Allowance > 0n) {
        setStepsCompleted(prev => ({ ...prev, 2: true }));
      }

      console.log("Token balances and allowances:", {
        token0Balance: ethers.formatUnits(token0Balance, token0Decimals),
        token1Balance: ethers.formatUnits(token1Balance, token1Decimals),
        token0Allowance: ethers.formatUnits(token0Allowance, token0Decimals),
        token1Allowance: ethers.formatUnits(token1Allowance, token1Decimals),
        lpTokenBalance: lpBalance
      });

      // Check if balances and allowances are sufficient
      if (token0Balance === 0n) {
        console.warn("Warning: Token0 balance is zero");
      }
      if (token1Balance === 0n) {
        console.warn("Warning: Token1 balance is zero");
      }
      if (token0Allowance === 0n) {
        console.warn("Warning: Token0 allowance is zero");
      }
      if (token1Allowance === 0n) {
        console.warn("Warning: Token1 allowance is zero");
      }

    } catch (error) {
      console.error("Error checking balances and allowances:", error);
      setDebugInfo(prev => ({
        ...prev,
        lastError: "Error checking balances: " + (error instanceof Error ? error.message : String(error))
      }));
    }
  };

  // Helper to check if pool is properly initialized
  const checkPoolStatus = async () => {
    try {
      // Check if pool has tokens set by verifying token0 and token1
      const token0 = await contract.token0();
      const token1 = await contract.token1();

      console.log("Pool status:", { token0, token1, isInitialized: true });

      return true;
    } catch (error) {
      console.error("Pool not initialized correctly:", error);
      throw new Error("Pool not initialized correctly. Please complete step 1 first.");
    }
  };

  const checkBalance = async () => {
    if (!forms.balanceCheck.address || !forms.balanceCheck.tokenAddress) {
      setTxStatus({
        status: "error",
        message: "Please enter a valid address and token address"
      });
      return;
    }

    setTxStatus({
      status: "pending",
      message: "Checking balance...",
      operation: "balanceCheck"
    });

    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';

      // Create a contract instance for the token
      const tokenContract = new ethers.Contract(
        forms.balanceCheck.tokenAddress,
        [
          "function balanceOf(address owner) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        new ethers.Wallet(privateKey, provider)
      );

      const [balance, decimals, symbol] = await Promise.all([
        tokenContract.balanceOf(forms.balanceCheck.address),
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      setResults(prev => ({
        ...prev,
        balance: `${ethers.formatUnits(balance, decimals)} ${symbol}`
      }));

      setTxStatus({
        status: "success",
        message: "Balance checked successfully!"
      });
    } catch (error: any) {
      setTxStatus({
        status: "error",
        message: error.reason || error.message || "Failed to check balance"
      });
      console.error(error);
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setTxStatus({ status: "none", message: "" });
    }, 5000);
  };

  const checkAllowance = async () => {
    if (!forms.allowanceCheck.owner || !forms.allowanceCheck.spender || !forms.allowanceCheck.tokenAddress) {
      setTxStatus({
        status: "error",
        message: "Please enter valid owner, spender, and token addresses"
      });
      return;
    }

    setTxStatus({
      status: "pending",
      message: "Checking allowance...",
      operation: "allowanceCheck"
    });

    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';

      // Create a contract instance for the token
      const tokenContract = new ethers.Contract(
        forms.allowanceCheck.tokenAddress,
        [
          "function allowance(address owner, address spender) view returns (uint256)",
          "function decimals() view returns (uint8)",
          "function symbol() view returns (string)"
        ],
        new ethers.Wallet(privateKey, provider)
      );

      const [allowance, decimals, symbol] = await Promise.all([
        tokenContract.allowance(forms.allowanceCheck.owner, forms.allowanceCheck.spender),
        tokenContract.decimals(),
        tokenContract.symbol()
      ]);

      setResults(prev => ({
        ...prev,
        allowance: `${ethers.formatUnits(allowance, decimals)} ${symbol}`
      }));

      setTxStatus({
        status: "success",
        message: "Allowance checked successfully!"
      });
    } catch (error: any) {
      setTxStatus({
        status: "error",
        message: error.reason || error.message || "Failed to check allowance"
      });
      console.error(error);
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setTxStatus({ status: "none", message: "" });
    }, 5000);
  };

  // Helper function to determine if a button should be disabled
  const isOperationDisabled = (operation: string) => {
    return txStatus.status === "pending" && (!txStatus.operation || txStatus.operation === operation);
  };

  // Helper components for the stepper UI
  const StepIndicator = ({
    stepNumber,
    currentStep,
    title,
    onClick
  }: {
    stepNumber: number,
    currentStep: number,
    title: string,
    onClick?: () => void
  }) => (
    <div
      className={`flex items-center ${stepNumber < currentStep ? "cursor-pointer" : ""}`}
      onClick={() => {
        // Only allow going back to previous steps
        if (stepNumber < currentStep && onClick) {
          onClick();
        }
      }}
    >
      <div
        className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 font-bold ${stepNumber < currentStep
            ? "bg-green-500 text-white"
            : stepNumber === currentStep
              ? "bg-blue-500 text-white"
              : "bg-gray-200 text-gray-500 dark:bg-gray-700 dark:text-gray-300"
          }`}
      >
        {stepNumber < currentStep ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        ) : (
          stepNumber
        )}
      </div>
      <div className={`font-semibold ${stepNumber <= currentStep
          ? "text-slate-700 dark:text-blue-200"
          : "text-slate-400 dark:text-slate-500"
        }`}>
        {title}
      </div>
    </div>
  );

  // Use the state variable instead of a local constant
  useEffect(() => {
    // Initial setup, but don't auto-advance steps
    if (currentStep === 0) {
      setCurrentStep(1);
    }
  }, [currentStep]);

  // Add these functions for minting tokens to the wallet

  // Fix the mintTestTokens function to use a simpler approach
  const mintTestTokens = async (tokenAddress: string, amount: string) => {
    try {
      if (!tokenAddress) {
        setTxStatus({
          status: "error",
          message: "Please provide a valid token address"
        });
        return;
      }

      setTxStatus({
        status: "pending",
        message: "Minting test tokens...",
        operation: "mintTokens"
      });

      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
      const signer = new ethers.Wallet(privateKey, provider);
      const signerAddress = await signer.getAddress();

      // Create a contract instance for the token
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function mint(address to, uint256 amount) public returns (bool)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );

      const decimals = await tokenContract.decimals();
      const amountInWei = ethers.parseUnits(amount, decimals);

      console.log(`Minting ${amount} tokens (${amountInWei} wei) to ${signerAddress} from token ${tokenAddress}`);

      try {
        const tx = await tokenContract.mint(signerAddress, amountInWei, { gasLimit: 10000000 });
        const receipt = await tx.wait();
        console.log("Mint transaction receipt:", receipt);
      } catch (error) {
        console.log("Direct mint call failed, trying fallback method:", error);
        // Fallback to the data payload used in the script
        const tx = await signer.sendTransaction({
          to: tokenAddress,
          data: `0x4e6ec247000000000000000000000000${signerAddress.slice(2)}${ethers.parseEther(amount).toString(16).padStart(64, '0')}`,
          gasLimit: 10000000,
        });
        const receipt = await tx.wait();
        console.log("Fallback mint transaction receipt:", receipt);
      }

      setTxStatus({
        status: "success",
        message: `Successfully minted ${amount} tokens!`
      });

      // Update token balances
      await checkTokenBalancesAndAllowances();

    } catch (error: any) {
      console.error("Error minting tokens:", error);
      setTxStatus({
        status: "error",
        message: error.reason || error.message || "Failed to mint tokens"
      });

      setDebugInfo(prev => ({
        ...prev,
        lastError: JSON.stringify(error, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      }));
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      if (txStatus.status !== "pending") {
        setTxStatus({ status: "none", message: "" });
      }
    }, 5000);
  };

  // First find the approveToken function and update it to accept an amount parameter
  const approveToken = async (tokenAddress: string, amount: string) => {
    try {
      if (!tokenAddress || !contractInfo.address) {
        setTxStatus({
          status: "error",
          message: "Please provide valid token and spender addresses"
        });
        return;
      }

      setTxStatus({
        status: "pending",
        message: "Approving token...",
        operation: "approveToken"
      });

      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
      const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
      const signer = new ethers.Wallet(privateKey, provider);

      // Create a contract instance for the token to approve
      const tokenContract = new ethers.Contract(
        tokenAddress,
        [
          "function approve(address spender, uint256 amount) returns (bool)",
          "function decimals() view returns (uint8)"
        ],
        signer
      );

      // Get token decimals
      const decimals = await tokenContract.decimals();

      // Convert amount to correct units with decimals
      const amountInWei = ethers.parseUnits(amount, decimals);

      console.log(`Approving ${amount} tokens (${amountInWei} wei) for spender ${contractInfo.address}`);

      // Call the approve function directly on the token contract
      const tx = await tokenContract.approve(contractInfo.address, amountInWei);
      await tx.wait();

      setTxStatus({
        status: "success",
        message: `Successfully approved ${amount} tokens!`
      });

      // Update token allowances
      await checkTokenBalancesAndAllowances();

      // Mark step 2 as completed
      setStepsCompleted(prev => ({ ...prev, 2: true }));

    } catch (error: any) {
      console.error("Error approving tokens:", error);
      setTxStatus({
        status: "error",
        message: error.reason || error.message || "Failed to approve tokens"
      });

      setDebugInfo(prev => ({
        ...prev,
        lastError: JSON.stringify(error, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      }));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center w-full my-auto p-4">
      <div className="bg-white dark:bg-gray-900/95 shadow-2xl rounded-3xl w-full max-w-5xl p-8 border border-slate-200 dark:border-blue-500/30">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-center mb-8">
          <div className="px-6 py-3 rounded-full">
            <h1 className="text-4xl font-extrabold tracking-tight text-blue-600 dark:text-cyan-400">
              Uniswap V2 Interface
            </h1>
          </div>
        </div>

        {/* Transaction Status Alert */}
        {txStatus.status !== "none" && (
          <div
            className={`transition-all duration-300 mb-8 border shadow-lg backdrop-blur-md rounded-2xl p-4 ${txStatus.status === "pending"
                ? "bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200 border-blue-200 dark:border-blue-500/40"
                : txStatus.status === "success"
                  ? "bg-green-50 text-green-700 dark:bg-green-900/50 dark:text-green-200 border-green-200 dark:border-green-500/40"
                  : "bg-red-50 text-red-700 dark:bg-red-900/50 dark:text-red-200 border-red-200 dark:border-red-500/40"
              }`}
          >
            <div className="flex items-center">
              {txStatus.status === "pending" && (
                <div className="h-5 w-5 border-t-2 border-b-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin mr-3"></div>
              )}
              {txStatus.status === "success" && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-3 text-green-500 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {txStatus.status === "error" && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 mr-3 text-red-500 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
              <span className="font-medium">{txStatus.message}</span>
            </div>
          </div>
        )}

        {/* Stepper UI */}
        <div className="mb-8">
          <div className="bg-slate-100/80 dark:bg-blue-900/40 rounded-2xl p-6 border border-slate-200 dark:border-blue-500/20 backdrop-blur-md">
            <h2 className="text-xl font-semibold text-slate-700 dark:text-blue-200 mb-6">Uniswap V2 Setup Guide</h2>
            <div className="space-y-6">
              <StepIndicator
                stepNumber={1}
                currentStep={currentStep}
                title="Initialize Uniswap V2 Pool"
                onClick={() => setCurrentStep(1)}
              />
              <div className={`ml-13 pl-6 border-l-2 ${currentStep >= 2 ? "border-blue-400" : "border-gray-300"}`}>
                <StepIndicator
                  stepNumber={2}
                  currentStep={currentStep}
                  title="Approve Tokens for Uniswap V2"
                  onClick={() => setCurrentStep(2)}
                />
              </div>
              <div className={`ml-13 pl-6 border-l-2 ${currentStep >= 3 ? "border-blue-400" : "border-gray-300"}`}>
                <StepIndicator
                  stepNumber={3}
                  currentStep={currentStep}
                  title="Add Liquidity (Mint)"
                  onClick={() => setCurrentStep(3)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Current Step Content */}
        <div className="space-y-8">
          {/* Step 1: Initialize Pool (Only shown when not initialized) */}
          {currentStep === 1 && (
            <div className="bg-slate-50 dark:bg-gray-800/80 rounded-2xl p-6 border border-slate-200 dark:border-blue-500/20">
              <h2 className="text-xl font-semibold text-slate-700 dark:text-blue-200 mb-4">Step 1: Initialize Pool</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Token0 Address"
                  className="w-full p-3 bg-white/70 dark:bg-blue-900/30 border border-slate-300 dark:border-blue-500/30 focus:border-blue-400 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-blue-900/40 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-blue-300/50 rounded-xl"
                  value={forms.initialize.token0}
                  onChange={e => updateForm("initialize", "token0", e.target.value)}
                  disabled={txStatus.status === "pending"}
                />
                <input
                  type="text"
                  placeholder="Token1 Address"
                  className="w-full p-3 bg-white/70 dark:bg-blue-900/30 border border-slate-300 dark:border-blue-500/30 focus:border-blue-400 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-blue-900/40 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-blue-300/50 rounded-xl"
                  value={forms.initialize.token1}
                  onChange={e => updateForm("initialize", "token1", e.target.value)}
                  disabled={txStatus.status === "pending"}
                />
                <input
                  type="text"
                  placeholder="Fee To Address"
                  className="w-full p-3 bg-white/70 dark:bg-blue-900/30 border border-slate-300 dark:border-blue-500/30 focus:border-blue-400 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-blue-900/40 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-blue-300/50 rounded-xl"
                  value={forms.initialize.feeTo}
                  onChange={e => updateForm("initialize", "feeTo", e.target.value)}
                  disabled={txStatus.status === "pending"}
                />
                <button
                  onClick={() =>
                    handleTransaction(
                      "initialize",
                      "Initializing pool...",
                      "Pool initialized successfully!",
                      forms.initialize.token0,
                      forms.initialize.token1,
                      forms.initialize.feeTo,
                      { gasLimit: 10000000 },
                    )
                  }
                  className={`w-full border-0 shadow-lg px-4 py-3 rounded-xl font-semibold 
                    ${isOperationDisabled("initialize")
                      ? "bg-slate-200 text-slate-400 dark:bg-blue-900/50 dark:text-blue-300/70 cursor-not-allowed"
                      : "bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500 text-white transform hover:scale-105 transition-all duration-300"
                    }`}
                  disabled={isOperationDisabled("initialize")}
                >
                  {txStatus.status === "pending" && txStatus.operation === "initialize" ? (
                    <div className="flex items-center justify-center">
                      <div className="h-5 w-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                      Initializing...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      Initialize Pool
                    </div>
                  )}
                </button>
              </div>

              {/* Next Step Button - Show when pool initialization succeeds */}
              {(stepsCompleted[1] || poolInitialized) && (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => {
                      setCurrentStep(2);
                      setTxStatus({ status: "none", message: "" }); // Clear the success message when moving to next step
                    }}
                    className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-md transition-all duration-300 flex items-center"
                  >
                    <span className="mr-2">Continue to Next Step</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Approve Tokens (Only shown after pool is initialized) */}
          {currentStep === 2 && (
            <div className="bg-slate-50 dark:bg-gray-800/80 rounded-2xl p-6 border border-slate-200 dark:border-blue-500/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-700 dark:text-blue-200">Step 2: Approve Tokens for Uniswap</h2>
                <button
                  onClick={() => setCurrentStep(1)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-slate-700 dark:text-blue-300 rounded-lg text-sm flex items-center transition-all duration-150"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Go Back
                </button>
              </div>
              <div className="space-y-6">
                {/* Token approval form with explanation */}
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-200 mb-4">
                  <p className="font-semibold mb-1">Why do I need to approve tokens?</p>
                  <p>Before adding liquidity, you need to give the Uniswap contract permission to use your tokens. This is a standard security measure in Ethereum.</p>
                  <p className="mt-2">Approve both tokens below before proceeding to the next step.</p>
                </div>

                {/* Display current token balances and allowances */}
                <div className="mb-6 bg-slate-100 dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-blue-900/30">
                  <h3 className="text-md font-semibold text-slate-700 dark:text-blue-300 mb-2">Your Token Status:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token0 Balance:</p>
                      <p className="font-mono text-green-600 dark:text-green-400">{debugInfo.token0Balance || "Not checked"}</p>

                      {/* Add mint button for token0 */}
                      {deployedTokens.token0 && (
                        <button
                          onClick={() => mintTestTokens(deployedTokens.token0, "1000")}
                          className="mt-2 px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-800/60 text-green-700 dark:text-green-300 rounded-md text-xs"
                        >
                          Mint 1000 Token0
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token1 Balance:</p>
                      <p className="font-mono text-green-600 dark:text-green-400">{debugInfo.token1Balance || "Not checked"}</p>

                      {/* Add mint button for token1 */}
                      {deployedTokens.token1 && (
                        <button
                          onClick={() => mintTestTokens(deployedTokens.token1, "1000")}
                          className="mt-2 px-3 py-1 bg-green-100 hover:bg-green-200 dark:bg-green-900/40 dark:hover:bg-green-800/60 text-green-700 dark:text-green-300 rounded-md text-xs"
                        >
                          Mint 1000 Token1
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token0 Allowance:</p>
                      <p className="font-mono text-purple-600 dark:text-purple-400">{debugInfo.token0Allowance || "Not checked"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token1 Allowance:</p>
                      <p className="font-mono text-purple-600 dark:text-purple-400">{debugInfo.token1Allowance || "Not checked"}</p>
                    </div>
                  </div>

                  {/* Check balances and allowances button */}
                  <div className="mt-3">
                    <button
                      onClick={checkTokenBalancesAndAllowances}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 rounded-md text-sm"
                    >
                      Refresh Token Status
                    </button>
                  </div>
                </div>

                {/* Token approval section */}
                <div className="space-y-4 mb-6">
                  <h3 className="text-lg font-medium text-slate-700 dark:text-blue-300">Approve Token0</h3>
                  <div className="p-4 bg-white/80 dark:bg-blue-950/40 rounded-xl border border-slate-200 dark:border-blue-800/30">
                    <p className="mb-2 text-sm text-slate-700 dark:text-blue-200">Token0 Address: <span className="font-mono">{deployedTokens.token0}</span></p>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Amount to Approve"
                        className="flex-1 p-2 bg-white/70 dark:bg-blue-900/30 border border-slate-300 dark:border-blue-500/30 focus:border-blue-400 dark:focus:border-blue-400 text-slate-800 dark:text-white rounded-lg"
                        value={forms.approve.token0Amount}
                        onChange={e => updateForm("approve", "token0Amount", e.target.value)}
                        disabled={txStatus.status === "pending"}
                      />
                      <button
                        onClick={() => approveToken(deployedTokens.token0, forms.approve.token0Amount || "1000")}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
                        disabled={txStatus.status === "pending"}
                      >
                        Approve
                      </button>
                    </div>
                  </div>

                  <h3 className="text-lg font-medium text-slate-700 dark:text-blue-300 mt-6">Approve Token1</h3>
                  <div className="p-4 bg-white/80 dark:bg-blue-950/40 rounded-xl border border-slate-200 dark:border-blue-800/30">
                    <p className="mb-2 text-sm text-slate-700 dark:text-blue-200">Token1 Address: <span className="font-mono">{deployedTokens.token1}</span></p>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        placeholder="Amount to Approve"
                        className="flex-1 p-2 bg-white/70 dark:bg-blue-900/30 border border-slate-300 dark:border-blue-500/30 focus:border-blue-400 dark:focus:border-blue-400 text-slate-800 dark:text-white rounded-lg"
                        value={forms.approve.token1Amount}
                        onChange={e => updateForm("approve", "token1Amount", e.target.value)}
                        disabled={txStatus.status === "pending"}
                      />
                      <button
                        onClick={() => approveToken(deployedTokens.token1, forms.approve.token1Amount || "1000")}
                        className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg"
                        disabled={txStatus.status === "pending"}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                </div>

                {/* Next Step Button - Show when approval succeeds */}
                {stepsCompleted[2] && (
                  <div className="mt-6 flex justify-center">
                    <button
                      onClick={() => {
                        setCurrentStep(3);
                        setTxStatus({ status: "none", message: "" }); // Clear the success message when moving to next step
                      }}
                      className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-md transition-all duration-300 flex items-center"
                    >
                      <span className="mr-2">Continue to Next Step</span>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Add Liquidity (Mint) Form */}
          {currentStep === 3 && (
            <div className="bg-slate-50 dark:bg-gray-800/80 rounded-2xl p-6 border border-slate-200 dark:border-blue-500/20">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-700 dark:text-blue-200">Step 3: Add Liquidity (Mint)</h2>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-blue-900/40 dark:hover:bg-blue-900/60 text-slate-700 dark:text-blue-300 rounded-lg text-sm flex items-center transition-all duration-150"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Go Back
                </button>
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-xl border border-blue-100 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-200 mb-6">
                <p className="font-semibold mb-1">Adding Liquidity:</p>
                <p>When you add liquidity, you deposit both tokens into the pool and receive LP tokens in return. These LP tokens represent your share of the pool.</p>
                
                <p className="mt-2 font-semibold">How Liquidity Works in Uniswap V2:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Uniswap V2 uses the full balance of both approved tokens in your wallet</li>
                  <li>LP tokens are minted based on the geometric mean (square root of product) of your deposited amounts</li>
                  <li>The ratio of tokens is important - the protocol automatically uses the maximum amount while maintaining the current pool ratio</li>
                  <li>LP token amounts appear small because they use 18 decimals, regardless of the token's own decimals</li>
                </ul>
                
                <p className="mt-2"><strong>LP Token Benefits:</strong></p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Earn a share of trading fees from swaps (0.3% fee per swap)</li>
                  <li>Redeem LP tokens later to get your tokens back plus accumulated fees</li>
                  <li>LP tokens can be transferred or used in other DeFi protocols</li>
                </ul>
                
                <div className="bg-yellow-50 dark:bg-yellow-900/30 p-3 mt-3 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <p className="font-semibold">Note about LP Token Amounts:</p>
                  <p>Your LP token balance may look small (like 0.000000000000001) because:</p>
                  <ul className="list-disc pl-5 mt-1">
                    <li>LP tokens have 18 decimals by default</li>
                    <li>First liquidity provider sets the initial exchange rate</li>
                    <li>The exact amount depends on the token decimals and current pool state</li>
                  </ul>
                </div>
                
                <p className="mt-3 font-semibold">Before adding liquidity:</p>
                <ul className="list-disc pl-5 mt-1">
                  <li>Make sure you've approved both token0 and token1 first</li>
                  <li>You need to have both tokens in your wallet</li>
                  <li>Enter your address below to receive LP tokens</li>
                </ul>
              </div>

              {/* Display current token balances and allowances */}
              {(debugInfo.token0Balance || debugInfo.token1Balance) && (
                <div className="mb-6 bg-slate-100 dark:bg-gray-800 p-4 rounded-xl border border-slate-200 dark:border-blue-900/30">
                  <h3 className="text-md font-semibold text-slate-700 dark:text-blue-300 mb-2">Your Token Status:</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token0 Balance:</p>
                      <p className="font-mono text-green-600 dark:text-green-400">{debugInfo.token0Balance || "Not checked"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token1 Balance:</p>
                      <p className="font-mono text-green-600 dark:text-green-400">{debugInfo.token1Balance || "Not checked"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token0 Allowance:</p>
                      <p className="font-mono text-purple-600 dark:text-purple-400">{debugInfo.token0Allowance || "Not checked"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600 dark:text-blue-200">Token1 Allowance:</p>
                      <p className="font-mono text-purple-600 dark:text-purple-400">{debugInfo.token1Allowance || "Not checked"}</p>
                    </div>
                    {debugInfo.lpTokenBalance && (
                      <div className="col-span-2 mt-2 pt-2 border-t border-slate-300 dark:border-slate-700">
                        <p className="text-sm text-slate-600 dark:text-blue-200">Your LP Token Balance:</p>
                        <p className="font-mono text-yellow-600 dark:text-yellow-400">
                          {debugInfo.lpTokenBalance}
                          {debugInfo.rawLpBalance !== "0" && (
                            <span className="text-xs ml-2 text-slate-500 dark:text-slate-400">
                              ({debugInfo.rawLpBalance} wei)
                            </span>
                          )}
                        </p>
                        {parseFloat(debugInfo.lpTokenBalance) === 0 && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            No LP tokens yet. Add liquidity to receive LP tokens.
                          </p>
                        )}
                        {parseFloat(debugInfo.lpTokenBalance) > 0 && (
                          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <p>LP tokens use 18 decimals. Even small values represent real ownership.</p>
                            <p className="mt-0.5">Your share of the pool: {(parseFloat(debugInfo.lpTokenBalance) * 100).toFixed(15)}% of total liquidity</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Check balances and allowances button */}
                  <div className="mt-3">
                    <button
                      onClick={checkTokenBalancesAndAllowances}
                      className="px-4 py-2 bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/50 dark:hover:bg-blue-800/60 text-blue-700 dark:text-blue-300 rounded-md text-sm"
                    >
                      Refresh Token Status
                    </button>
                  </div>
                </div>
              )}

              {/* Add mint form here */}
              <div className="space-y-4 mb-6">
                <label className="block text-slate-700 dark:text-blue-200 font-medium">Recipient Address for LP Tokens</label>
                <input
                  type="text"
                  placeholder="Your Address to Receive LP Tokens"
                  className="w-full p-3 bg-white/70 dark:bg-blue-900/30 border border-slate-300 dark:border-blue-500/30 focus:border-blue-400 dark:focus:border-blue-400 focus:bg-white dark:focus:bg-blue-900/40 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-blue-300/50 rounded-xl"
                  value={forms.mint.to}
                  onChange={e => updateForm("mint", "to", e.target.value)}
                  disabled={txStatus.status === "pending"}
                />

                <div className="p-4 bg-white/80 dark:bg-blue-950/40 rounded-xl border border-slate-200 dark:border-blue-800/30">
                  <h3 className="text-lg font-medium text-slate-700 dark:text-blue-300 mb-2">Pool Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-slate-500 dark:text-blue-300">Token0:</p>
                      <p className="text-slate-700 dark:text-white text-sm font-mono break-all">{deployedTokens.token0}</p>
                    </div>
                    <div className="p-3 bg-slate-50 dark:bg-blue-900/20 rounded-lg">
                      <p className="text-sm text-slate-500 dark:text-blue-300">Token1:</p>
                      <p className="text-slate-700 dark:text-white text-sm font-mono break-all">{deployedTokens.token1}</p>
                    </div>
                  </div>
                </div>

                {/* Show detailed error info if available */}
                {debugInfo.lastError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-900/40 text-sm text-red-700 dark:text-red-300">
                    <h4 className="font-semibold mb-1">Transaction Error Details:</h4>
                    <div className="mt-1 overflow-auto max-h-32 p-2 bg-white/70 dark:bg-black/30 rounded-md text-xs font-mono">
                      {debugInfo.lastError}
                    </div>
                    <div className="mt-3 text-sm">
                      <p><strong>Common reasons for failure:</strong></p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>Pool not initialized correctly (Token0 and Token1 must match the ones used in Step 1)</li>
                        <li>Insufficient token balances (Check that you have both tokens)</li>
                        <li>Insufficient token allowances (Approve both tokens in Step 2)</li>
                        <li>Internal contract error (Check console for more details)</li>
                      </ul>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => {
                    // First check balances and allowances
                    checkTokenBalancesAndAllowances().then(() => {
                      // Ensure we have a valid recipient address, defaulting to the signer address if empty
                      const ensureValidAddress = async () => {
                        if (!forms.mint.to) {
                          const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || '');
                          const privateKey = process.env.NEXT_PUBLIC_PRIVATE_KEY || '';
                          const signer = new ethers.Wallet(privateKey, provider);
                          const signerAddress = await signer.getAddress();
                          updateForm("mint", "to", signerAddress);
                          return signerAddress;
                        }
                        return forms.mint.to;
                      };

                      ensureValidAddress().then(validAddress => {
                        // Then try to mint
                        handleTransaction(
                          "mint",
                          "Minting liquidity...",
                          "Liquidity minted successfully!",
                          validAddress,
                          { gasLimit: 10000000 }
                        );
                      });
                    });
                  }}
                  className={`w-full border-0 shadow-lg px-4 py-3 rounded-xl font-semibold 
                    ${isOperationDisabled("mint")
                      ? "bg-slate-200 text-slate-400 dark:bg-green-900/50 dark:text-green-300/70 cursor-not-allowed"
                      : "bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-500 text-white transform hover:scale-105 transition-all duration-300"
                    }`}
                  disabled={isOperationDisabled("mint")}
                >
                  {txStatus.status === "pending" && txStatus.operation === "mint" ? (
                    <div className="flex items-center justify-center">
                      <div className="h-5 w-5 border-t-2 border-b-2 border-white rounded-full animate-spin mr-2"></div>
                      Adding Liquidity...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 mr-2"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                      </svg>
                      Add Liquidity
                    </div>
                  )}
                </button>
              </div>

              {/* Show success message after minting */}
              {(stepsCompleted[3] || txStatus.status === "success" && txStatus.message === "Liquidity minted successfully!") && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-100 dark:border-green-800">
                  <div className="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="font-semibold text-green-700 dark:text-green-300">Success! You've added liquidity to the pool</h3>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    You can now refresh your token status to see your LP token balance.
                  </p>
                  <div className="mt-3 p-3 bg-green-100 dark:bg-green-800/40 rounded-lg text-sm">
                    <p className="font-medium text-green-700 dark:text-green-300">What happens now?</p>
                    <ul className="list-disc pl-5 mt-1 text-green-600 dark:text-green-400">
                      <li>Your tokens are now in the liquidity pool</li>
                      <li>You received LP tokens representing your share of the pool</li>
                      <li>As users trade using this pool, you'll earn fees proportional to your share</li>
                      <li>You can redeem your LP tokens anytime to withdraw your liquidity plus earned fees</li>
                    </ul>
                    <p className="mt-2 text-green-600 dark:text-green-400">
                      <strong>Note:</strong> The LP token amount may appear small because LP tokens use 18 decimals regardless of the token pair's decimals. Even a small number like 0.000000000000001 LP tokens correctly represents your ownership share.
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <button
                  onClick={() => checkTokenBalancesAndAllowances()}
                  className="px-4 py-2 bg-green-100 hover:bg-green-200 dark:bg-green-800/60 text-green-700 dark:text-green-300 rounded-md text-sm"
                >
                  Refresh LP Token Balance
                </button>
              </div>

              {/* Next Step Button - Show when mint succeeds */}
              {(stepsCompleted[3] || txStatus.status === "success" && txStatus.message === "Liquidity minted successfully!") && (
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 rounded-xl border border-green-100 dark:border-green-800">
                  <div className="flex items-center mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <h3 className="font-semibold text-green-700 dark:text-green-300">All steps completed successfully!</h3>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    You have successfully added liquidity to the pool. You can now refresh your token status to see your LP token balance.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Display tabs only if not in the guided setup */}
          {false && <div className="flex mb-8 bg-slate-100/80 dark:bg-blue-900/40 rounded-2xl p-2 border border-slate-200 dark:border-blue-500/20 backdrop-blur-md">
            {Object.values(TABS).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-3 px-4 rounded-xl transition-all duration-300 font-semibold ${activeTab === tab
                    ? "bg-white dark:bg-blue-800 text-blue-600 dark:text-blue-300 shadow-md transform scale-105"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-blue-700/50"
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>}
        </div>
      </div>
    </div>
  );
}