import React from "react";

import { APP_STATES } from "../utils/types";
import AppBody from "./AppBody";
import { createStream, getStreamStatus } from "../utils/apiFactory";
import { useSelector, useDispatch } from "react-redux";
function App() {
  const dispatch = useDispatch();
  const state = useSelector((state) => state.stream);

  React.useEffect(() => {
    if (state.appState === APP_STATES.CREATING_STREAM) {
      (async function () {
        try {
          const streamCreateResponse = await createStream(state.apiKey);

          if (streamCreateResponse.data) {
            const {
              id: streamId,
              playbackId,
              streamKey,
            } = streamCreateResponse.data;
            dispatch({
              type: "STREAM_CREATED",
              payload: {
                streamId,
                playbackId,
                streamKey,
              },
            });
          }
        } catch (error) {
          if (error.response.status === 403) {
            dispatch({
              type: "INVALID_API_KEY",
              payload: {
                message:
                  "Invalid API Key. Please try again with right API key!",
              },
            });
          } else {
            dispatch({
              type: "INVALID_API_KEY",
              payload: {
                message:
                  "Something went wrong! Please try again after sometime",
              },
            });
          }
        }
      })();
    }

    let interval;
    if (state.streamId) {
      interval = setInterval(async () => {
        const streamStatusResponse = await getStreamStatus(
          state.apiKey,
          state.streamId
        );

        if (streamStatusResponse.data) {
          const { isActive } = streamStatusResponse.data;
          dispatch({
            type: isActive ? "VIDEO_STARTED" : "VIDEO_STOPPED",
          });
        }
      }, 5000);
    }

    return () => {
      clearInterval(interval);
    };
  }, [state.appState]);

  const VideoStarted = false;

  return (
    <div
      className="container pb-12 h-screen m-auto pt-24 lg:pt-40"
      style={{
        display: "grid",
        "place-items": "center",
        height: "90vh",
        backgroundColor: "#303233",
      }}
    >
      {/* <header className="w-full p-3 flex justify-between items-center fixed top-0 left-0 z-10 bg-white">
        <a
          href="https://livepeer.com/docs/"
          target="_blank"
          rel="noopener, nofollow"
          className="logo flex flex-col flex-1 lg:w-1/5"
        >
          <h1 className="font-bold text-xl">Livepeer.com API Demo</h1>
        </a>

        <button
          className="border p-2 h-1/2 rounded border-livepeer hover:bg-livepeer hover:text-white"
          onClick={() => dispatch({ type: "RESET_DEMO_CLICKED" })}
        >
          Reset Demo
        </button>
      </header> */}

      <AppBody
        state={state}
        setApiKey={(apiKey) =>
          dispatch({ type: "SUBMIT_API_KEY", payload: { apiKey } })
        }
        createStream={() => dispatch({ type: "CREATE_CLICKED" })}
      />

      {state.error && (
        <div className="bg-black bg-opacity-60 flex items-center justify-center fixed top-0 left-0 h-screen w-screen">
          <div className="flex flex-col w-1/3 h-56 bg-white p-12 items-center text-center text-lg rounded">
            {state.error}
            <button
              className="border p-2 w-1/3 rounded  mt-4"
              onClick={() => dispatch({ type: "RESET_DEMO_CLICKED" })}
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
