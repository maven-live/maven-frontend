import React from "react";
import { encrypt, recoverTypedMessage } from "eth-sig-util";
import { ethers } from "ethers";
import axios from "axios";
import { keccak256 } from "ethers/lib/utils";
import { connect } from "react-redux";
import { getV3TypedData, getV4TypedData, whiteLabelData } from "./data";
import web3Obj from "./helper";
import { setUserToStore } from "./redux/user/actions";
import { setWalletToStore, resetWalletFromStore } from "./redux/wallet/actions";

import "./components/Header/header.css";

import { clusterApi, Connection } from "@solana/web3.js";

import Torus from "@toruslabs/solana-embed";

import Header from "./components/Header/Header";
import "./components/Header/header.css";
import Recommended_users from "./components/Recommended_users/Recommended_users";
import "./components/Recommended_users/Recommended_users.css";

import Layout from "./hoc/Layout";
import "../src/hoc/Layout.css";

const tokenAbi = require("human-standard-token-abi");
const torus = new Torus();

import { url } from "./env";

class Login extends React.Component {
  state = {
    publicAddress: "",
    chainId: 4,
    verifierId: "",
    selectedVerifier: "google",
    placeholder: "Enter google email",
    chainIdNetworkMap: {
      1: "mainnet",
      3: "ropsten",
      4: "rinkeby",
      5: "goerli",
      42: "kovan",
      97: "bsc_testnet",
      56: "bsc_mainnet",
    },
    messageToEncrypt: "",
    encryptionKey: "",
    messageEncrypted: "",
    buildEnv: "testing",
    toursObject: false,
    toursReady: false,
  };

  componentDidMount() {
    this.setupTorus();
  }

  setupTorus = async () => {
    await torus.init({
      buildEnv: "mainnet", // uses solana-testing.tor.us (which uses testnet)
      enableLogging: true, // default : false
      showTorusButton: true, // default: true
    });
    //
    this.props.setWalletInfoToStore({ torusReady: true });
  };

  login = async () => {
    try {
      const { web3 } = web3Obj;
      const { buildEnv, chainIdNetworkMap, chainId } = this.state;
      const acc = await torus.login(); // await torus.ethereum.enable()
      const publicKey = acc[0];
      const userInfo = await torus.getUserInfo();

      // set user to store
      try {
        const res = await axios.post(`${url("/user/create")}`, userInfo);
        if (res.data) {
          console.log(res.data.data.hexa);
          this.props.setUserToStore({
            ...userInfo,
            hexa: res.data.data.hexa,
            userId: res.data.data.id,
          });
        }
      } catch (error) {
        console.log(error);
      }

      sessionStorage.setItem("pageUsingTorus", buildEnv);
      web3Obj.setweb3(torus.provider);

      torus.provider.on("chainChanged", (resp) => {
        this.props.setWalletInfoToStore({
          chainId: resp,
        });
      });

      torus.provider.on("accountsChanged", (accounts) => {
        this.props.setWalletInfoToStore({
          publicAddress: (Array.isArray(accounts) && accounts[0]) || "",
        });
      });
      this.props.setWalletInfoToStore({
        publicAddress: publicKey,
      });
    } catch (error) {
      console.error(error, "caught in vue-app");
    }
  };

  // Display the widget at bottom left
  toggleTorusWidget = () => {
    const { torus } = web3Obj;
    if (torus.torusWidgetVisibility) {
      torus.hideTorusButton();
    } else {
      torus.showTorusButton();
    }
  };

  onSelectedVerifierChanged = (e) => {
    const verifier = e.target.value;
    let placeholder = "Enter google email";
    switch (verifier) {
      case "google":
        placeholder = "Enter google email";
        break;
      case "reddit":
        placeholder = "Enter reddit username";
        break;
      case "discord":
        placeholder = "Enter discord ID";
        break;
      default:
        placeholder = "Enter google email";
        break;
    }
    this.setState({
      selectedVerifier: verifier,
      placeholder,
    });
  };

  changeProvider = async () => {
    await web3Obj.torus.setProvider({ host: "mainnet" });
    this.console("finished changing provider");
  };

  createPaymentTx = async () => {
    try {
      const { torus } = web3Obj;
      const res = await torus.initiateTopup("mercuryo", {
        selectedCurrency: "USD",
      });
      console.log(res);
    } catch (error) {
      console.error(error);
    }
  };

  sendEth = () => {
    const { web3 } = web3Obj;
    const { publicAddress } = this.state;
    web3.eth
      .sendTransaction({
        from: publicAddress,
        to: publicAddress,
        value: web3.utils.toWei("0.01"),
      })
      .then((resp) => this.console(resp))
      .catch(console.error);
  };

  signMessageWithoutPopup = () => {
    const { web3 } = web3Obj;
    const { publicAddress } = this.state;

    // hex message
    const message = "Hello world";
    const customPrefix = `\u0019${window.location.hostname} Signed Message:\n`;
    const prefixWithLength = Buffer.from(
      `${customPrefix}${message.length.toString()}`,
      "utf-8"
    );
    const hashedMsg = keccak256(
      Buffer.concat([prefixWithLength, Buffer.from(message)])
    );
    web3.currentProvider?.send(
      {
        method: "eth_sign",
        params: [
          publicAddress,
          hashedMsg,
          { customPrefix, customMessage: message },
        ],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }
        const signerAddress = ethers.utils.recoverAddress(
          hashedMsg,
          result.result
        );
        return this.console(
          "sign message => true",
          `message: ${prefixWithLength + message}`,
          `msgHash: ${hashedMsg}`,
          `sig: ${result.result}`,
          `signer: ${signerAddress}`
        );
      }
    );
  };

  signMessage = () => {
    const { web3 } = web3Obj;
    const { publicAddress } = this.state;
    // hex message
    const message =
      "0x47173285a8d7341e5e972fc677286384f802f8ef42a5ec5f03bbfa254cb01fad";
    web3.currentProvider?.send(
      {
        method: "eth_sign",
        params: [publicAddress, message],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }
        return this.console("sign message => true", result);
      }
    );
  };

  signTypedDataV1 = () => {
    const { publicAddress } = this.state;
    const typedData = [
      {
        type: "string",
        name: "message",
        value: "Hi, Alice!",
      },
      {
        type: "uint8",
        name: "value",
        value: 10,
      },
    ];
    const currentProvider = web3Obj.web3.currentProvider;
    currentProvider.send(
      {
        method: "eth_signTypedData",
        params: [typedData, publicAddress],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }

        const recovered = recoverTypedMessage(
          {
            data: typedData,
            sig: result.result,
          },
          "V1"
        );

        if (
          publicAddress &&
          recovered.toLowerCase() === publicAddress?.toLowerCase()
        ) {
          return this.console(
            `sign typed message v1 => true, Singature: ${result.result} Recovered signer: ${publicAddress}`,
            result
          );
        }
        return this.console(`Failed to verify signer, got: ${recovered}`);
      }
    );
  };

  signTypedDataV3 = () => {
    const { chainId, publicAddress } = this.state;
    const typedData = getV3TypedData(chainId);
    const currentProvider = web3Obj.web3.currentProvider;
    currentProvider.send(
      {
        method: "eth_signTypedData_v3",
        params: [publicAddress, JSON.stringify(typedData)],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }
        const recovered = recoverTypedMessage(
          {
            data: typedData,
            sig: result.result,
          },
          "V3"
        );

        if (recovered.toLowerCase() === publicAddress?.toLowerCase()) {
          return this.console(
            `sign typed message v3 => true, Singature: ${result.result} Recovered signer: ${publicAddress}`,
            result
          );
        }
        return this.console(`Failed to verify signer, got: ${recovered}`);
      }
    );
  };

  signTypedDataV4 = () => {
    const { chainId, publicAddress } = this.state;
    const { web3 } = web3Obj;
    const typedData = getV4TypedData(chainId);
    web3.currentProvider?.send(
      {
        method: "eth_signTypedData_v4",
        params: [publicAddress, JSON.stringify(typedData)],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }
        const recovered = recoverTypedMessage(
          {
            data: typedData,
            sig: result.result,
          },
          "V4"
        );

        if (recovered.toLowerCase() === publicAddress.toLowerCase()) {
          return this.console(
            "sign typed message v4 => true",
            result.result,
            `Recovered signer: ${publicAddress}`,
            result
          );
        }
        return this.console(`Failed to verify signer, got: ${recovered}`);
      }
    );
  };

  console = (...args) => {
    const el = document.querySelector("#console>p");
    if (el) {
      el.innerHTML = JSON.stringify(args || {}, null, 2);
    }
  };

  sendDai = async () => {
    try {
      const { chainId, publicAddress } = this.state;
      const { torus, web3 } = web3Obj;
      if (chainId !== 1) {
        await torus.setProvider({ host: "mainnet" });
      }
      const instance = new web3.eth.Contract(
        tokenAbi,
        "0x6b175474e89094c44da98b954eedeac495271d0f"
      );
      const balance = await instance.methods.balanceOf(publicAddress).call();
      console.log(balance, "dai balance");
      const value = Math.floor(
        parseFloat("0.01") * 10 ** parseFloat("18")
      ).toString();
      if (Number(balance) < Number(value)) {
        // eslint-disable-next-line no-alert
        window.alert("You do not have enough dai tokens for transfer");
        return;
      }
      instance.methods.transfer(publicAddress, value).send(
        {
          from: publicAddress,
        },
        (err, hash) => {
          if (err) this.console(err);
          else this.console(hash);
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  approveKnc = async () => {
    try {
      const { chainId, publicAddress } = this.state;
      const { torus, web3 } = web3Obj;
      console.log(chainId, "current chain id");
      if (chainId !== 1) {
        await torus.setProvider({ host: "mainnet" });
      }
      const instance = new web3.eth.Contract(
        tokenAbi,
        "0xdd974D5C2e2928deA5F71b9825b8b646686BD200"
      );
      let value = Math.floor(
        parseFloat("0.01") * 10 ** parseFloat("18")
      ).toString();
      const allowance = await instance.methods
        .allowance(publicAddress, "0x3E2a1F4f6b6b5d281Ee9a9B36Bb33F7FBf0614C3")
        .call();
      console.log(allowance, "current allowance");
      if (Number(allowance) > 0) value = "0";
      instance.methods
        .approve("0x3E2a1F4f6b6b5d281Ee9a9B36Bb33F7FBf0614C3", value)
        .send(
          {
            from: publicAddress,
          },
          (err, hash) => {
            if (err) this.console(err);
            else this.console(hash);
          }
        );
    } catch (error) {
      console.error(error);
    }
  };

  signPersonalMsg = async () => {
    try {
      const { web3 } = web3Obj;
      const { publicAddress } = this.state;
      const message = "Some string";
      const hash = web3.utils.sha3(message);
      const sig = await web3.eth.personal.sign(hash, publicAddress, "");
      const hostnamealAddress = await web3.eth.personal.ecRecover(hash, sig);
      if (publicAddress.toLowerCase() === hostnamealAddress.toLowerCase())
        this.console("Success");
      else this.console("Failed");
    } catch (error) {
      console.error(error);
      this.console("failed");
    }
  };

  getUserInfo = () => {
    const { torus } = web3Obj;
    torus.getUserInfo("").then(this.console).catch(this.console);
  };

  getPublicAddress = () => {
    const { torus } = web3Obj;
    const { selectedVerifier, verifierId } = this.state;
    console.log(selectedVerifier, verifierId);
    torus
      .getPublicAddress({ verifier: selectedVerifier, verifierId })
      .then(this.console)
      .catch(console.error);
  };

  getEncryptionKey = () => {
    const { web3 } = web3Obj;
    const { publicAddress } = this.state;
    web3.currentProvider?.send(
      {
        method: "eth_getEncryptionPublicKey",
        params: [publicAddress],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }
        this.props.setWalletInfoToStore({
          encryptionKey: result.result,
        });
        return this.console(`encryption public key => ${result.result}`);
      }
    );
  };

  encryptMessage = () => {
    try {
      const { encryptionKey, messageToEncrypt } = this.state;
      const messageEncrypted = encrypt(
        encryptionKey,
        { data: messageToEncrypt },
        "x25519-xsalsa20-poly1305"
      );
      const encryptedMessage = this.stringifiableToHex(messageEncrypted);
      this.setState({
        messageEncrypted: encryptedMessage,
      });
      this.console(`encrypted message => ${encryptedMessage}`);
    } catch (error) {
      console.error(error);
    }
  };

  decryptMessage = () => {
    const { web3 } = web3Obj;
    const { messageEncrypted, publicAddress } = this.state;
    web3.currentProvider?.send(
      {
        method: "eth_decrypt",
        params: [messageEncrypted, publicAddress],
        jsonrpc: "2.0",
      },
      (err, result) => {
        if (err) {
          return console.error(err);
        }
        const decMsg = result.result;
        return this.console(`decrypted message => ${decMsg}`);
      }
    );
  };

  stringifiableToHex = (value) =>
    ethers.utils.hexlify(Buffer.from(JSON.stringify(value)));

  logout = () => {
    web3Obj.torus
      .cleanUp()
      .then(() => {
        this.props.resetWalletFromStore();
        return undefined;
      })
      .catch(console.error);
  };

  render() {
    const { publicAddress, toursReady } = this.state;
    return (
      <div className="App">
        <Layout
          clickHandler={() => {
            this.login.bind(this)();
          }}
          logoutHandler={() => {
            this.logout.bind(this)();
          }}
          publicAddress={publicAddress}
        />
      </div>
    );
  }
}

const mapStateToProps = (state) => {
  return {
    user: state.user,
    wallet: state.wallet,
  };
};

const mapDispatchToProps = (dispatch) => {
  return {
    setUserToStore: (user) => dispatch(setUserToStore(user)),
    setWalletInfoToStore: (walletInfo) => {
      console.log("here dhamaal", walletInfo);
      return dispatch(setWalletToStore(walletInfo));
    },
    resetWalletFromStore: () => dispatch(resetWalletFromStore()),
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Login);
