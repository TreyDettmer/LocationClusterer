import { Component, AfterViewInit, ViewChild} from '@angular/core';
import { UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { LoadLoggerService } from './services/load-logger.service';
import { Status, WorkerResponse } from './interfaces/worker-response';
import { MapComponent } from './components/map/map.component';
import * as csv from 'csvtojson';
import { MatDialog } from '@angular/material/dialog';
import { ClusterSwitcherDialogComponent } from './components/cluster-switcher-dialog/cluster-switcher-dialog.component';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map, retry } from 'rxjs/operators';

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

  public HoveredClusterIndex : number = -1;

  public HoveredClusterDistance : number = -1;
  public HoveredClusterTime : number = -1;

  @ViewChild('map') mapComponent! : MapComponent;

  

  settingsForm : UntypedFormGroup = new UntypedFormGroup({
    minimumClusterCount: new UntypedFormControl(5,[Validators.min(1)]),
    maximumClusterCount: new UntypedFormControl(20,[Validators.max(80)]),
    maxDistance: new UntypedFormControl(500,[Validators.min(1),Validators.max(1000)])
  });

  constructor(public loadLoggerService : LoadLoggerService, public dialog : MatDialog, private http: HttpClient)
  {
    
  }

  ngAfterViewInit(): void 
  { 

    this.mapComponent.OnInnerClusterPointClicked.subscribe(({innerPointIndex,clusterIndex}) =>
    {
      this.OnInnerClusterPointClicked(innerPointIndex,clusterIndex);
    });

    this.mapComponent.OnClusterMouseOver.subscribe(({clusterIndex}) =>
    {
      if (this.HoveredClusterIndex != clusterIndex)
      {
        this.HoveredClusterIndex = clusterIndex;
        if (this.Clusters[clusterIndex])
        {
          if (this.Clusters[clusterIndex].length < 12)
          {
            this.HoveredClusterDistance = Math.round((Math.random() * 30) * 10) / 10;
            this.HoveredClusterTime = Math.round((this.HoveredClusterDistance / 30) * 10) / 10;
            // // get cluster milage
            // this.getClusterMilage(this.Clusters[clusterIndex]).subscribe((data:any) => 
            // {
            //   console.log(data);
            //   if (data.code)
            //   {
            //     if (data.code == "Ok")
            //     {
            //       this.mapComponent.DrawRoute(data.waypoints);
            //       if (data.trips.length > 0)
            //       {
            //         // 1609 is the number of meters in a mile
            //         console.log(data.trips[0].distance / 1609);
            //         let distance = Math.round((data.trips[0].distance / 1609) * 10) / 10;
            //         this.HoveredClusterDistance = distance;
            //       }
            //     }
            //     else
            //     {
            //       this.HoveredClusterDistance = -2;
            //       console.log("mapbox API failure");
            //     }
            //   }
            //   else
            //   {
            //     this.HoveredClusterDistance = -2;
            //     console.log("mapbox API failure");
            //   }
              
            // })
          }
          else
          {
            this.HoveredClusterDistance = -2;
            this.HoveredClusterTime = -2;
            //console.log("too big of cluster");
          }
        }
        
      }
    });

    this.mapComponent.OnClusterMouseLeave.subscribe(({clusterIndex}) =>
    {
      console.log("left");
      this.HoveredClusterIndex = -1;
      this.HoveredClusterDistance = -1;
      this.HoveredClusterTime = -1;

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
    console.log(location);
    let url = "https://api.mapbox.com/geocoding/v5/mapbox.places/2%20Lincoln%20Memorial%20Cir%20NW.json?access_token=pk.eyJ1IjoidHJleWRldHRtZXIiLCJhIjoiY2xoOGRpOTdkMDdkdjNtbHg2eThveHI2bCJ9.E_C_Uek056pn85-2jDiICA";
    let addressEncoding = "2823 Kirsch Dr Antelope CA 95843"
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

  
  // called when user uploads a file
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
        // console.log(`Length before duplicate removal: ${this.dataFrame.length}`);
        
        // this.dataFrame = [...new Map(this.dataFrame.map(v => [`${v["MemberAddress"]}` ,v])).values()];
        // console.log(`Length after duplicate address removal: ${this.dataFrame.length}`);
        // this.dataFrame = [...new Map(this.dataFrame.map(v => [`${v[this.LATITUDE]}${v[this.LONGITUDE]}` ,v])).values()];
        // console.log(`Length after duplicate location removal: ${this.dataFrame.length}`);
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

  // called when user clicks on 'save clustered data'
  public SaveFile()
  {
    function arrayToCSV (data : any) {
      let csv = data.map((row : any) => Object.values(row));
      csv.unshift(Object.keys(data[0]));
      return `${csv.join('\n').replace(/,/g, ',')}`;
    }

    // add new cluster column to dataframe
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
    if (!(this.dataFrame[0]["Longitude"] || this.dataFrame[0]["longitude"] || this.dataFrame[0]["Lng"] || this.dataFrame[0]["lng"]))
    {
      return false;
    }
    return true;
  }

  private setLongitudeAndLatitudeConstants()
  {
      if (this.dataFrame[0]["Longitude"])
      {
        this.LONGITUDE = "Longitude";
      }
      else if (this.dataFrame[0]["longitude"])
      {
        this.LONGITUDE = "longitude";
      }
      else if (this.dataFrame[0]["Lng"])
      {
        this.LONGITUDE = "Lng";
      }
      else if (this.dataFrame[0]["lng"])
      {
        this.LONGITUDE = "lng";
      } 

      if (this.dataFrame[0]["Latitude"])
      {
        this.LATITUDE = "Latitude";
      }
      else if (this.dataFrame[0]["latitude"])
      {
        this.LATITUDE = "latitude";
      }
      else if (this.dataFrame[0]["Lat"])
      {
        this.LATITUDE = "Lat";
      }
      else if (this.dataFrame[0]["lat"])
      {
        this.LATITUDE = "lat";
      } 


  }


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
      // Create a new web worker to do the calculations
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

  getClusterMilage(cluster : any) : Observable<any>
  {

    let locationsArray = [];
    for (let i = 0; i < cluster.length; i++)
    {
      //mapbox expects longitude then latitude
      locationsArray.push([cluster[i][1],cluster[i][0]]);
    }
    //mapbox expects longitude then latitude
    //locationsArray = [[45.576132, -122.728306],[45.559022,-122.645381],[45.474393,-122.636938]];
    //locationsArray = [[-122.728306,45.576132],[-122.645381,45.559022],[-122.636938,45.474393]];
    let locationsArrayString1 = [];
    for (let i = 0; i < locationsArray.length; i++)
    {
      locationsArrayString1.push(locationsArray[i].join(','));
    }
    let locationsArrayString = locationsArrayString1.join(';');
    console.log(locationsArrayString);
    let accessToken = "pk.eyJ1IjoidHJleWRldHRtZXIiLCJhIjoiY2xoOGRsd3JzMDQ1ejNkbzZiZmNvNGNxaCJ9.fGOdn3Ju30RKt11nZ_fBww";
    let baseURL = "https://valhalla1.openstreetmap.de/optimized_route/";
    let url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving/${locationsArrayString}?steps=true&access_token=${accessToken}`;
    return this.http.get<any>(url).pipe(
      map((response : any) => {
        return response;
      }),
      catchError((err, caught) => {
        console.error(err);
        throw err;
      }
      )
    )
  }

}

