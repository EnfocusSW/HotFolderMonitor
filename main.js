"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const tmp = __importStar(require("tmp"));
async function timerFired(s, flowElement) {
    flowElement.setTimerInterval(parseInt(await (await flowElement.getPropertyStringValue("Interval")).toString()));
    //get list of files from previous run
    let previousFiles = await s.getGlobalData(Scope.FlowElement, "HotFolderMonitor.PreviousFiles");
    if (previousFiles == "") {
        previousFiles = [];
    }
    else {
        try {
            previousFiles = JSON.parse(previousFiles);
        }
        catch (error) {
            await flowElement.log(LogLevel.Warning, "Could not parse the content of the global data");
            previousFiles = [];
        }
    }
    //get list of current files
    let folderPath = await (await flowElement.getPropertyStringValue("Folder")).toString();
    let currentFiles;
    try {
        currentFiles = await fs.readdirSync(folderPath);
    }
    catch (error) {
        //if the content of the folder cannot be read the element cannot function
        await flowElement.failProcess("Could not read the contents of the folder %1", folderPath);
        return;
    }
    //if the previous list and the current list are empty, it is OK and we can exit
    if (previousFiles.length == 0 && currentFiles.length == 0) {
        return;
    }
    //add current list to global data
    await s.setGlobalData(Scope.FlowElement, "HotFolderMonitor.PreviousFiles", JSON.stringify(currentFiles));
    //check if files in current list are also in the previous list because then it means they were not processed yet
    //and this probably means that some external program is down
    let stuckFiles = [];
    for (let i = 0; i < previousFiles.length; i++) {
        for (let j = 0; j < currentFiles.length; j++) {
            if (previousFiles[i] == currentFiles[j]) {
                if (currentFiles[j] != ".DS_Store") {
                    stuckFiles.push(currentFiles[j]);
                }
            }
        }
    }
    //check if there are files that are stuck and if so, write them to a text file and inject that file as a new job
    if (stuckFiles.length !== 0) {
        try {
            let tmpFilePath = tmp.fileSync().name; //create a temporary path
            await fs.writeFileSync(tmpFilePath, stuckFiles); //write to the temporary path
            let newJob = await flowElement.createJob(tmpFilePath); //create a new job pointing to the temporary path
            await newJob.sendToSingle("hotfoldermonitor.txt"); //send the new job and name it as required
            await fs.unlinkSync(tmpFilePath); //remove the temporary path
        }
        catch (err) {
            await flowElement.log(LogLevel.Error, err.message);
        }
    }
}
//# sourceMappingURL=main.js.map