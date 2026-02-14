const button = document.getElementById("main-button");
const filterbutton = document.getElementById("filter-button");
const normalisebutton = document.getElementById("normalise-button");

let state = "init";
let device;

async function setup() {

    const patchExportURL = "export/patch.export.json";

    // Create AudioContext from user gesture
    const WAContext = window.AudioContext || window.webkitAudioContext;
    const context = new WAContext();
    await context.resume();

    // Request microphone
    let micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        },
        video: false
    });

    // Safari stabilization delay
    await new Promise(r => setTimeout(r, 100));

    // Fetch RNBO patch
    let response = await fetch(patchExportURL);
    let patcher = await response.json();

    if (!window.RNBO) {
        await loadRNBOScript(patcher.desc.meta.rnboversion);
    }

    // Create RNBO device
    device = await RNBO.createDevice({ context, patcher });

    // Load dependencies if present
    try {
        const dependenciesResponse = await fetch("export/dependencies.json");
        let dependencies = await dependenciesResponse.json();
        dependencies = dependencies.map(d =>
            d.file ? Object.assign({}, d, { file: "export/" + d.file }) : d
        );
        await device.loadDataBufferDependencies(dependencies);
    } catch (e) {}

    // Create output node
    const outputNode = context.createGain();
    outputNode.connect(context.destination);

    // Connect mic + device
    const micSource = context.createMediaStreamSource(micStream);

    micSource.connect(device.node);
    device.node.connect(outputNode);


    //check if mobile and tweak audio settings if so
	document.getElementById("audio-settings").style.display = "block";
    if (window.matchMedia("(pointer: coarse)").matches){
		device.parametersById.get("enable_filter").value = 1;
		filterbutton.textContent = "Low-pass Enabled";
		device.parametersById.get("enable_normalisation").value = 0;
		normalisebutton.textContent = "Auto-gain Disabled";
	}
}

function loadRNBOScript(version) {
    return new Promise((resolve, reject) => {
        if (/^\d+\.\d+\.\d+-dev$/.test(version)) {
            throw new Error("Patcher exported with a Debug Version!\nPlease specify the correct RNBO version to use in the code.");
        }
        const el = document.createElement("script");
        el.src = "https://c74-public.nyc3.digitaloceanspaces.com/rnbo/" + encodeURIComponent(version) + "/rnbo.min.js";
        el.onload = resolve;
        el.onerror = function(err) {
            console.log(err);
            reject(new Error("Failed to load rnbo.js v" + version));
        };
        document.body.append(el);
    });
}


button.addEventListener("click", async () => {
  switch (state) {

    case "init":
      await setup();
      state = "ready";
      button.textContent = "Start Recording";
      break;

    case "ready":
      device.parametersById.get("start_recording").value = 1;
      state = "recording";
      button.textContent = "Stop Recording";
      break;

    case "recording":
	  device.parametersById.get("start_recording").value = 0;
      device.parametersById.get("stop_recording").value = 1;
      state = "playing";
      button.textContent = "Stop Playback";
      break;

    case "playing":
	  device.parametersById.get("stop_recording").value = 0;
      device.parametersById.get("stop_playback").value = 1;
      state = "ready";
      button.textContent = "Start Recording";
      break;
  }
});

filterbutton.addEventListener("click", async () => {
	const enablefilter = device.parametersById.get("enable_filter");
	
	if (enablefilter.value == 0){
		enablefilter.value = 1;
		filterbutton.textContent = "Low-pass Enabled";
	}
	else{
		enablefilter.value = 0;
		filterbutton.textContent = "Low-pass Disabled";
	}
});

normalisebutton.addEventListener("click", async () => {
	const enablenormalise = device.parametersById.get("enable_normalisation");
	
	if (enablenormalise.value == 0){
		enablenormalise.value = 1;
		normalisebutton.textContent = "Auto-gain Enabled";
	}
	else{
		enablenormalise.value = 0;
		normalisebutton.textContent = "Auto-gain Disabled";
	}
});