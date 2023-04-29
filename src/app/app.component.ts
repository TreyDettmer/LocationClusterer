import { Component, AfterViewInit, ViewChild} from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { LoadLoggerService } from './services/load-logger.service';
import { Status, WorkerResponse } from './interfaces/worker-response';
import { MapComponent } from './components/map/map.component';
import * as csv from 'csvtojson';
import { MatDialog } from '@angular/material/dialog';
import { ClusterSwitcherDialogComponent } from './components/cluster-switcher-dialog/cluster-switcher-dialog.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit{
  title = 'Location-Cluster';

  private LONGITUDE : string = "longitude";
  private LATITUDE : string = "latitude";

  public Clusters: number[][][] = [];

  public UploadedFile : any = undefined;
  public UploadedFileName : string = "";


  private dataFrame! : any[];
  private dataFrameLocations!: number[][];

  public ShowSpinner : boolean = false;


  @ViewChild('map') mapComponent! : MapComponent;

  

  settingsForm : FormGroup = new FormGroup({
    minimumClusterCount: new FormControl(5,[Validators.min(2)]),
    maximumClusterCount: new FormControl(20,[Validators.max(20)]),
    maxDistance: new FormControl(500,[Validators.min(1),Validators.max(1000)])
  });

  constructor(public loadLoggerService : LoadLoggerService, public dialog : MatDialog)
  {
    
  }

  ngAfterViewInit(): void 
  { 

    this.mapComponent.OnInnerClusterPointClicked.subscribe(({innerPointIndex,clusterIndex}) =>
    {
      this.OnInnerClusterPointClicked(innerPointIndex,clusterIndex);
    });

  }

  private OnInnerClusterPointClicked(innerPointIndex : number,clusterIndex : number)
  {
    let location = this.Clusters[clusterIndex][innerPointIndex];
    let indexInDataframe = 0;
    for (let i = 0; i < this.dataFrameLocations.length; i++)
    {
      if (this.dataFrameLocations[i][0] == location[0] && this.dataFrameLocations[i][1] == location[1] && this.dataFrameLocations[i][2] == clusterIndex)
      {
        indexInDataframe = i;
        break;
      }
    }

    // open dialog allowing user to reassign location's cluster
    const dialogRef = this.dialog.open(ClusterSwitcherDialogComponent,
      {
        data: {currentClusterIndex: clusterIndex, newClusterIndex: clusterIndex}
      });
    dialogRef.afterClosed().subscribe(result =>
      {
        if (result !== undefined)
        {
          if (result != clusterIndex)
          {
            if (result >= 0 && result < this.Clusters.length)
            {
              // update with new cluster value
              this.dataFrameLocations[indexInDataframe][2] = result;
              this.Clusters[result].push([location[0],location[1]]);
              this.Clusters[clusterIndex].splice(innerPointIndex,1);
              this.mapComponent.UpdateMapMarkers(this.Clusters);
              this.mapComponent.DisplayPointsInCluster(this.Clusters,result);
            }
          }
        }
      })
  }

  

  public UploadedFileChanged(e : any)
  {
    if (!e.target.files[0])
    {
      return;
    }
    this.UploadedFile = e.target.files[0];
  
    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      csv().fromString(fileReader.result as string).then((jsonObj) =>
      {
        this.dataFrame = jsonObj;
        if (!this.isValidCsvFile())
        {
          alert("Invalid file: missing longitude or latitude information");
          this.UploadedFile = undefined;
          this.UploadedFileName = "";
          return;
        }
        this.UploadedFileName = this.UploadedFile.name;
        this.setLongitudeAndLatitudeConstants();

        this.dataFrameLocations = new Array(this.dataFrame.length).fill([0,0]);
        for (let i = 0; i < this.dataFrame.length; i++)
        {
          this.dataFrameLocations[i] = [parseFloat(this.dataFrame[i][this.LATITUDE]),parseFloat(this.dataFrame[i][this.LONGITUDE])];
          
          // replace non numbers with 0
          if (isNaN(this.dataFrameLocations[i][0]))
          {
            this.dataFrameLocations[i] = [0,this.dataFrameLocations[i][1]];
          }
          if (isNaN(this.dataFrameLocations[i][1]))
          {
            this.dataFrameLocations[i] = [this.dataFrameLocations[i][0],0];
          }
        }

      },
      (error) =>
      {
        console.error(error);
      });
    }
    fileReader.onprogress = (data) => 
    {
      if (data.lengthComputable)
      {
        let progress = ((data.loaded / data.total) * 100);
        console.log(`File Upload Progress: ${progress}`);
      }
    }
    fileReader.readAsText(this.UploadedFile); 
  }

  public SaveFile()
  {
    function arrayToCSV (data : any) {
      let csv = data.map((row : any) => Object.values(row));
      csv.unshift(Object.keys(data[0]));
      return `${csv.join('\n').replace(/,/g, ',')}`;
    }

    for (let i = 0; i < this.dataFrame.length; i++)
    {
      this.dataFrame[i]["cluster"] = this.dataFrameLocations[i][2];
    }

    let fileName = "ClusteredData.csv";
    let fileContent : string = arrayToCSV(this.dataFrame);
    const file = new Blob([fileContent],{type: "text/csv"});
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = fileName;
    link.click();
    link.remove();
  }

  private resetClusterValues()
  {
    for (let i = 0; i < this.dataFrame.length; i++)
    {
      if ("cluster" in this.dataFrame[i])
      {
        this.dataFrame[i]["cluster"] = 0;
      }
    }
  }

  private isValidCsvFile() : boolean
  {
    if ((!this.dataFrame[0]["longitude"] && !this.dataFrame[0]["Longitude"]) ||(!this.dataFrame[0]["latitude"] && !this.dataFrame[0]["Latitude"]))
    {
      return false;
    }
    return true;
  }

  private setLongitudeAndLatitudeConstants()
  {
      if (this.dataFrame[0]["longitude"])
      {
        this.LONGITUDE = "longitude";
      }
      else
      {
        this.LONGITUDE = "Longitude";
      }
      if (this.dataFrame[0]["latitude"])
      {
        this.LATITUDE = "latitude";
      }
      else
      {
        this.LATITUDE = "Latitude";
      }
  }









  // public parseCsvFile(data : any)
  // {
  //   this.points = [];
  //   try
  //   {
  //     let csvToRowArray = data.split("\n");
  //     for (let index = 1; index < csvToRowArray.length - 1; index++) {
  //       let row = csvToRowArray[index].split(",");
  //       let latitude : number = parseFloat( row[1]);
  //       let longitude : number = parseFloat( row[0]);
  //       if (isNaN(longitude) || isNaN(latitude))
  //       {
  //         console.error(`improper file format`);
  //         return;
  //       }
  //       this.points.push([latitude,longitude]);
  //     }
  //     console.log( `Read ${ this.points.length} points`);
  //   }
  //   catch (error)
  //   {
  //     console.error(`${error}`);
  //   }
    
  // }



  FindValidClusters()
  {

    
    if (this.dataFrameLocations.length == 0)
    {
      alert("No data to cluster");
      return;
    }
    if (this.settingsForm.controls["minimumClusterCount"].value >= this.settingsForm.controls["maximumClusterCount"].value)
    {
      alert("Minimum Clusters must be less than Maximum Clusters");

      return;
    }

    this.mapComponent.ClearMarkers();
    this.Clusters = [];
    this.resetClusterValues();
    this.ShowSpinner = true;
    this.loadLoggerService.LogMessage("");
    if (typeof Worker !== 'undefined') {
      // Create a new
      const worker = new Worker(new URL('./app.worker', import.meta.url));
      worker.onmessage = ({data}) => {
        let workerResponse = data as WorkerResponse;
        if (workerResponse.status == Status.Progess)
        {
          this.loadLoggerService.LogMessage(workerResponse.message || "");
        }
        else if (workerResponse.status == Status.Error)
        {
          this.loadLoggerService.LogMessage(workerResponse.message || "",true);
          this.ShowSpinner = false;
        }
        else
        {
          this.dataFrameLocations = workerResponse.data.points;
          this.Clusters = workerResponse.data.clusters;
          this.mapComponent.ClearMarkers();
          this.mapComponent.UpdateMapMarkers(this.Clusters);
          this.loadLoggerService.LogMessage("");
          this.ShowSpinner = false;
        }


      };
      worker.postMessage({
        points:this.dataFrameLocations,
        clusters:this.Clusters,
        minimumClusters:this.settingsForm.controls["minimumClusterCount"].value,
        maximumClusters: this.settingsForm.controls["maximumClusterCount"].value, 
        maxDistance: this.settingsForm.controls["maxDistance"].value 
      });
    } else {
      // Web workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
      console.warn("Workers aren't available");
      this.loadLoggerService.LogMessage("Web Workers are unavailable in your browser",true);
      this.ShowSpinner = false;
    }
  }
}

