import * as fs from "fs";
import * as tmp from "tmp";

async function timerFired(s: Switch, flowElement: FlowElement) {
  flowElement.setTimerInterval(parseInt(await (await flowElement.getPropertyStringValue("Interval")).toString()));

  //get list of files from previous run
  let previousFiles: string | string[] = await s.getGlobalData(Scope.FlowElement, "HotFolderMonitor.PreviousFiles");
  if (previousFiles == "") {
    previousFiles = [];
  } else {
    try {
      previousFiles = JSON.parse(previousFiles);
    } catch (error) {
      await flowElement.log(LogLevel.Warning, "Could not parse the content of the global data");
      previousFiles = [];
    }
  }

  let obj: Record<string, any> = {};
  obj.a = 1;

  //get list of current files
  let folderPath = await (await flowElement.getPropertyStringValue("Folder")).toString();
  let currentFiles;
  try {
    currentFiles = await fs.readdirSync(folderPath);
  } catch (error) {
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
      //s.log( 1, "Comparing " + previousFilesList[i] + " with " + currentFilesList[j]);
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
    } catch (err) {
      await flowElement.log(LogLevel.Error, err.message);
    }
  }
}