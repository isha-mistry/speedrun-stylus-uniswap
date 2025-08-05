// Only run this as a WASM if the export-abi feature is not set.
#![cfg_attr(not(feature = "export-abi"), no_main)]
extern crate alloc;

mod erc20;
use crate::erc20::{UniswapV2ERC20, UniswapV2ERC20Params};
use stylus_sdk::{prelude::*, alloy_primitives::{U256, Address}};
use stylus_cache_sdk::{is_contract_cacheable};

// Define parameters type for ERC20 inheritance
struct UniswapV2PairParams;

impl UniswapV2ERC20Params for UniswapV2PairParams {}

sol_storage! {
    #[entrypoint]
    struct UniswapV2Pair {
        address token0;
        address token1;
        address fee_to;
        #[borrow]
        UniswapV2ERC20<UniswapV2PairParams> token;
    }
}

#[public]
#[inherit(UniswapV2ERC20<UniswapV2PairParams>)]
impl UniswapV2Pair {
    pub fn is_cacheable(&self) -> bool {
        is_contract_cacheable()
    }

    pub fn initialize_isha(&mut self, token0: Address, token1: Address, fee_to: Address) -> Result<(), Vec<u8>> {
        if self.token0.get() != Address::ZERO {
            return Err("Already initialized".into());
        }
        self.token0.set(token0);
        self.token1.set(token1);
        self.fee_to.set(fee_to);
        Ok(())
    }

    pub fn mint(&mut self, to: Address) -> Result<U256, Vec<u8>> {
        // Check if the address is valid
        if to == Address::ZERO {
            return Err("Cannot mint to the zero address".into());
        }
        
        // Check if the pool has been initialized
        if self.token0.get() == Address::ZERO || self.token1.get() == Address::ZERO {
            return Err("Pool not initialized".into());
        }
        
        // Mint a fixed amount of LP tokens (simplified implementation)
        let amount = U256::from(1000);
        self.token.mint(to, amount)?;
        Ok(amount)
    }

    pub fn token0(&self) -> Result<Address, Vec<u8>> {
        Ok(self.token0.get())
    }

    pub fn token1(&self) -> Result<Address, Vec<u8>> {
        Ok(self.token1.get())
    }
}
