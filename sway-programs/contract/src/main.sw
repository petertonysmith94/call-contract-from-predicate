contract;

use std::{call_frames::{msg_asset_id,}, context::msg_amount,};


// The abi defines the blueprint for the contract.
abi Counter {
    #[payable]
    fn deposit() -> (AssetId, u64);
}


impl Counter for Contract {
    #[payable]
    fn deposit() -> (AssetId, u64) {
      let asset_id = msg_asset_id();
      let amount = msg_amount();

      return (asset_id, amount);
    }
}
