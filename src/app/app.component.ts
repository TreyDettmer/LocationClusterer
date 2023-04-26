import { Component, AfterViewInit, ViewChild} from '@angular/core';
import { KMeans, setBackend } from 'scikitjs';
import * as tf from '@tensorflow/tfjs'
import * as L from 'leaflet';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { LoadLoggerService } from './services/load-logger.service';
import { Status, WorkerResponse } from './interfaces/worker-response';
import { MapComponent } from './components/map/map.component';
import * as csv from 'csvtojson';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit{
  title = 'geo-cluster';

  private LONGITUDE : string = "longitude";
  private LATITUDE : string = "latitude";

  //private points : number[][] = [];


  public clusters: number[][][] = [];
  
  private markers : L.LayerGroup = new L.LayerGroup();

  private miniMarkers : L.LayerGroup = new L.LayerGroup();

  public uploadedFile : any = undefined;
  public UploadedFileName : string = "";

  private icons : any = [];
  private miniIcons : any = [];
  private colors : string[] = [];

  private visiblePoints : number[][] = [];

  private dataFrame! : any[];
  private dataFrameLocations!: number[][];
  private d! : any;

  showSpinner : boolean = false;


  @ViewChild('map') mapComponent! : MapComponent;

  

  settingsForm : FormGroup = new FormGroup({
    minimumClusterCount: new FormControl(5,[Validators.min(2)]),
    maximumClusterCount: new FormControl(20,[Validators.max(20)]),
    maxDistance: new FormControl(500,[Validators.min(1),Validators.max(1000)])
  });

  constructor(public loadLoggerService : LoadLoggerService)
  {
    
  }

  ngAfterViewInit(): void 
  { 
    // register tensorflow as the backend
    setBackend(tf);

  }

  

  public UploadedFileChanged(e : any)
  {
    if (!e.target.files[0])
    {
      return;
    }
    this.uploadedFile = e.target.files[0];
  
    let fileReader = new FileReader();
    fileReader.onload = (e) => {
      console.log("done");
      csv().fromString(fileReader.result as string).then((jsonObj) =>
      {
        this.dataFrame = jsonObj;
        if (!this.isValidCsvFile())
        {
          alert("Invalid file: missing longitude or latitude information");
          this.uploadedFile = undefined;
          this.UploadedFileName = "";
          return;
        }
        this.UploadedFileName = this.uploadedFile.name;
        this.setLongitudeAndLatitudeConstants();
        this.addClusterColumn();

        this.dataFrameLocations = new Array(this.dataFrame.length).fill([0,0]);
        for (let i = 0; i < this.dataFrame.length; i++)
        {
          this.dataFrameLocations[i] = [parseFloat(this.dataFrame[i][this.LATITUDE]),parseFloat(this.dataFrame[i][this.LONGITUDE])];
        }

      })
    }
    fileReader.onprogress = (data) => 
    {
      if (data.lengthComputable)
      {
        let progress = ((data.loaded / data.total) * 100);
        console.log(`Progress: ${progress}`);
      }
    }
    fileReader.readAsText(this.uploadedFile); 
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
      this.dataFrame[i]["cluster"] = 0;
    }
  }

  private addClusterColumn()
  {
    for (let i = 0; i < this.dataFrame.length; i++)
    {
      this.dataFrame[i]["cluster"] = 0;
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
    this.clusters = [];
    this.resetClusterValues();
    this.showSpinner = true;
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
          this.showSpinner = false;
        }
        else
        {
          this.dataFrameLocations = workerResponse.data.points;
          this.clusters = workerResponse.data.clusters;
          console.log(this.clusters);
          console.log(this.dataFrameLocations);
          this.mapComponent.ClearMarkers();
          this.mapComponent.UpdateMapMarkers(this.clusters);
          this.loadLoggerService.LogMessage("");
          this.showSpinner = false;
        }


      };
      console.log("Starting worker");
      console.log(this.dataFrameLocations);
      worker.postMessage({
        points:this.dataFrameLocations,
        clusters:this.clusters,
        minimumClusters:this.settingsForm.controls["minimumClusterCount"].value,
        maximumClusters: this.settingsForm.controls["maximumClusterCount"].value, 
        maxDistance: this.settingsForm.controls["maxDistance"].value 
      });
    } else {
      // Web workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
      console.warn("Workers aren't available");
      this.showSpinner = false;
    }
    

    // for (let i = this.settingsForm.controls["minimumClusterCount"].value; i < this.settingsForm.controls["maximumClusterCount"].value; i++)
    // {
    //   console.log(`Checking for a valid ${i} cluster solution`);

      
    //   if (this.points.length > 0)
    //   {
    //     if (this.points[0].length > 2)
    //     {
    //       // remove cluster previous labels
    //       this.points = this.points.map(function(val) {
    //         return val.slice(0, -1);
    //       });
    //     }
    //   }
    //   this.clusters = [];
    //   this.createClusters(i,this.points);
    //   //this.createClusters(i,this.points);
    //   if (this.validateSolution())
    //   {
    //     this.markers.clearLayers();
    //     this.updateMapMarkers();
    //     this.isDoingWork = false;
    //     this.showLoader = false;
    //     return;
    //   }
    // }
    // console.log(`Unable to find a valid cluster solution between ${this.settingsForm.controls["minimumClusterCount"].value} and ${this.settingsForm.controls["maximumClusterCount"].value} clusters`);
    // this.LogInformation = `Unable to find a valid cluster solution between ${this.settingsForm.controls["minimumClusterCount"].value} and ${this.settingsForm.controls["maximumClusterCount"].value} clusters`;
    // this.isDoingWork = false;
    // this.showLoader = false;
  }
}

