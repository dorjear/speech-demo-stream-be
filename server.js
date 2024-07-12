const express = require('express');
const WebSocket = require('ws');
const sdk = require('microsoft-cognitiveservices-speech-sdk');
require('dotenv').config();
const app = express();
const port = 3001;

const wss = new WebSocket.Server({ noServer: true });

const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, process.env.AZURE_REGION);

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    const pushStream = sdk.AudioInputStream.createPushStream();
    const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);

    // Write the incoming audio data to the push stream
    pushStream.write(message);
    pushStream.close();

    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    recognizer.recognizeOnceAsync((result) => {
      if (result.reason === sdk.ResultReason.RecognizedSpeech) {
        ws.send(JSON.stringify({ text: result.text }));
      } else if (result.reason === sdk.ResultReason.NoMatch) {
        ws.send(JSON.stringify({ text: 'No speech could be recognized.' }));
      } else if (result.reason === sdk.ResultReason.Canceled) {
        const cancellation = sdk.CancellationDetails.fromResult(result);
        console.error(`CANCELED: Reason=${cancellation.reason}`);

        if (cancellation.reason === sdk.CancellationReason.Error) {
          console.error(`CANCELED: ErrorCode=${cancellation.ErrorCode}`);
          console.error(`CANCELED: ErrorDetails=${cancellation.errorDetails}`);
          ws.send(JSON.stringify({ text: `Error: ${cancellation.errorDetails}` }));
        } else {
          ws.send(JSON.stringify({ text: `Canceled: ${cancellation.reason}` }));
        }
      }
    });
  });
});

const server = app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});
