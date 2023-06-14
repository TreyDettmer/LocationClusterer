import { Component, AfterViewInit, ViewChild, Input} from '@angular/core';
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
import { Patient } from './interfaces/patient';
import { Cluster } from './interfaces/cluster';
import * as L from 'leaflet';
var polyUtil = require('polyline-encoded');

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

  private patients : Patient[] = [];


  private dataFrame! : any[];
  private dataFrameLocations!: number[][];

  public ShowSpinner : boolean = false;

  public SelectedCluster : Cluster | null = null;
  public SelectedPatient : Patient | null = null;
  public SelectedPatients : Patient[] = [];
  public IsChoosingNewClusterForPatient : boolean = false;

  private timeOfLastBoxSelect : number = Date.now();


  @ViewChild('map') mapComponent! : MapComponent;
  public HasInitializedMap = false;
  

  settingsForm : UntypedFormGroup = new UntypedFormGroup({
    maxDiameter: new UntypedFormControl(10,[Validators.min(1),Validators.max(25),Validators.required]),
  });

  actionsForm : UntypedFormGroup = new UntypedFormGroup({
    kmeansK : new UntypedFormControl(2,[Validators.min(2),Validators.max(20),Validators.required])
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

    this.mapComponent.OnClusterClicked.subscribe(({cluster}) =>
    {
      this.OnClusterClicked(cluster);
    })

    this.mapComponent.OnBoxSelect.subscribe(({bounds}) =>
    {
      this.OnBoxSelect(bounds);
    }) 

    this.mapComponent.OnPatientsClicked.subscribe(({patients, cluster}) =>
    {
      this.OnPatientsClicked(patients,cluster);
    })

    this.mapComponent.OnDeselect.subscribe(({}) =>
    {
      this.OnDeselect();
    })
    this.HasInitializedMap = true;




  }

  public GetClusterEstimatedMilage(event : any)
  {
    if (this.SelectedCluster == null || this.SelectedCluster.patients.length >= 12)
    {
      return;
    }


    // get cluster milage
    this.GetClusterMilage(this.SelectedCluster).subscribe((data:any) => 
    {
      console.log(data);
      if (data.code)
      {
        if (data.code == "Ok")
        {
          if (data.trips.length > 0)
          {
            // 1609 is the number of meters in a mile
            try
            {
              let latlngs = polyUtil.decode(data.trips[0].geometry)
              this.mapComponent.DrawRoundTrip(latlngs);
            }
            catch (error)
            {
              console.log(error);
            }
            
            console.log(data.trips[0].distance / 1609.34);
            let distance = Math.round((data.trips[0].distance / 1609.34) * 10) / 10;
            this.SelectedCluster!.milageEstimate = distance;
          }
        }
        else
        {
          console.log("mapbox API failure");
        }
      }
      else
      {
        console.log("mapbox API failure");
      }
      
    })

  }

  // nullifies selectedCluster and SelectedPatient
  private OnDeselect()
  {
    if (Date.now() - this.timeOfLastBoxSelect < 500)
    {
      return;
    }
    console.log("DESELECT");

    if (this.SelectedCluster != null)
    {
      this.SelectedCluster.isHighlighted = false;
      this.SelectedCluster.shouldDisplayArea = true;
    }
    
    
    this.CancelPatientSelection();
    this.SelectedCluster = null;
  }

  public DeleteCluster(event : any)
  {
    event.preventDefault();
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.mapComponent.DeleteCluster(this.SelectedCluster);
    this.SelectedCluster = null;
  }

  private CancelPatientSelection()
  {
    
    for (let i = 0; i < this.SelectedPatients.length; i++)
    {

      try
      {
        this.SelectedPatients[i].marker.getElement()?.classList.remove('patient-icon-hovered','patient-icon-highlighted');
      }
      catch
      {

      }
      
    }
    this.SelectedPatients = [];
    this.SelectedPatient = null;
  }

  private OnClusterClicked(cluster: Cluster)
  {
    // when we release from the box select, we want to ignore the click from the end mouse release so we wait a little
    if (Date.now() - this.timeOfLastBoxSelect < 500)
    {
      return;
    }
    console.log("cluster selected");
    //console.log(cluster);
    if (this.IsChoosingNewClusterForPatient)
    {
      this.OnPatientReassignConfirmation(cluster);
      return;
    }
    this.CancelPatientSelection();
    if (this.SelectedCluster != null)
    {
      this.SelectedCluster.isHighlighted = false;
      this.SelectedCluster.shouldDisplayArea = true;
    }
    this.SelectedCluster = cluster;
    this.SelectedCluster.isHighlighted = true;

    
  }

  public OnPatientReassignRequest(event : any,patient : Patient | null)
  {
    event.preventDefault();
    if (this.IsChoosingNewClusterForPatient)
    {
      this.IsChoosingNewClusterForPatient = false;
      this.SelectedPatient = null;
      return;
      
    }
    this.IsChoosingNewClusterForPatient = true;
    this.SelectedPatient = patient;

  }

  private OnPatientReassignConfirmation(newCluster : Cluster)
  {
    this.IsChoosingNewClusterForPatient = false;
    if (this.SelectedPatient != null)
    {
      if (this.SelectedCluster == null)
      {
        console.log(`Patient__${this.SelectedPatient.patUID} in cluster_-1 reassigned to cluster_${newCluster.patients.length}`);
        this.mapComponent.SwitchPatientsAssignedCluster([this.SelectedPatient],null,newCluster);
      }
      else
      {
        console.log(`Patient_${this.SelectedPatient.patUID} in cluster_${this.SelectedCluster.patients.length} reassigned to cluster_${newCluster.patients.length}`);
        this.mapComponent.SwitchPatientsAssignedCluster([this.SelectedPatient],this.SelectedCluster,newCluster);
      }
    }
    else if (this.SelectedPatients.length > 0)
    {
      
      if (this.SelectedCluster == null)
      {
        console.log(`${this.SelectedPatients.length} Patients in cluster_-1 reassigned to cluster_${newCluster.patients.length}`);
        this.mapComponent.SwitchPatientsAssignedCluster(this.SelectedPatients,null,newCluster);
      }
      else
      {
        console.log(`${this.SelectedPatients.length} Patients in cluster_${this.SelectedCluster.patients.length} reassigned to cluster_${newCluster.patients.length}`);
        this.mapComponent.SwitchPatientsAssignedCluster(this.SelectedPatients,this.SelectedCluster,newCluster);
      }


    }
    this.CancelPatientSelection();
    this.OnDeselect();
  }

  private OnPatientsClicked(patients : Patient[], cluster : Cluster | null)
  {
    if (this.IsChoosingNewClusterForPatient)
    {
      return;
    }
    this.CancelPatientSelection();
    for (let i = 0; i < this.SelectedPatients.length; i++)
    {
      try
      {
        this.SelectedPatients[i].marker.getElement()?.classList.remove('patient-icon-hovered','patient-icon-highlighted');
      }
      catch
      {

      }
    }
    this.SelectedPatients = [];
    for (let i = 0; i < patients.length; i++)
    {
      try
      {
        patients[i].marker.getElement()?.classList.add('patient-icon-highlighted');
      }
      catch
      {

      }
      
      this.SelectedPatients.push(patients[i]);
    }


    if (cluster != null)
    {
      console.log(cluster);
      if (this.SelectedCluster != null)
      {
        if (this.SelectedCluster != cluster)
        {
          // assign new selected cluster
          this.SelectedCluster.isHighlighted = false;
          cluster.isHighlighted = true;
          this.SelectedCluster = cluster;
        }
      }
      else
      {
        cluster.isHighlighted = true;
        this.SelectedCluster = cluster;
      }
    }
    else
    {
      console.log("cluster is null");
      if (this.SelectedCluster != null)
      {
        this.SelectedCluster.isHighlighted = false;
        this.SelectedCluster.shouldDisplayArea = true;
        this.SelectedCluster = null;
      }
    }
    return;
    const dialogRef = this.dialog.open(ClusterSwitcherDialogComponent,
      {
        data: {currentClusterIndex: 0, newClusterIndex: 0}
      });
    dialogRef.afterClosed().subscribe(result =>
      {
        if (result !== undefined)
        {
          
          // if (result != clusterIndex)
          // {
          //   if (result >= 0 && result < this.Clusters.length)
          //   {
          //     // update with new cluster value
          //     this.dataFrameLocations[indexInDataframe][2] = result;
          //     this.Clusters[result].push([location[0],location[1]]);
          //     this.Clusters[clusterIndex].splice(innerPointIndex,1);
          //     //this.mapComponent.UpdateMapMarkers(this.Clusters);
          //     this.mapComponent.DisplayPointsInCluster(this.Clusters,result);
          //   }
          // }
        }
      })
  }

  private OnBoxSelect(boxBounds : L.LatLngBounds )
  {

    // get the patients within the bounds
    let boundedPatients : Patient[] = [];
    for (let i = 0; i < this.patients.length; i++)
    {
      if (boxBounds.contains(this.patients[i].location))
      {
        boundedPatients.push(this.patients[i]);
      }
    }

    // remove patients that are not visible
    for (let patientIndex = boundedPatients.length - 1; patientIndex >= 0; patientIndex--)
    {
      for (let clusterIndex = 0; clusterIndex < this.mapComponent.Clusters.length; clusterIndex++)
      {
        if (this.mapComponent.Clusters[clusterIndex].patients.includes(boundedPatients[patientIndex]) && !this.mapComponent.Clusters[clusterIndex].shouldDisplayPatients)
        {
          boundedPatients.splice(patientIndex,1);
          break;
        }
      }
    }

    if (boundedPatients.length == 0)
    {
      for (let i = 0; i < this.SelectedPatients.length; i++)
      {
  
        try
        {
          this.SelectedPatients[i].marker.getElement()?.classList.remove('patient-icon-hovered','patient-icon-highlighted');
        }
        catch
        {
  
        }
      }
      this.SelectedPatients = [];
      return;
    }
    




    // ensure that the bounded patients are within the same cluster
    let chosenCluster : Cluster | null = null;
    for (let i = 0; i < this.mapComponent.Clusters.length; i++)
    {
      for (let j = 0; j < boundedPatients.length; j++)
      {
        if (this.mapComponent.Clusters[i].patients.includes(boundedPatients[j]))
        {
          if (chosenCluster != null && chosenCluster != this.mapComponent.Clusters[i])
          {
            console.log("points in different clusters")
            return;
          }
          let c = this.mapComponent.Clusters[i];
          chosenCluster = c;
        }
      }
    }

    // select the cluster of the bounded patients
    if (this.SelectedCluster == null)
    {
      this.SelectedCluster = chosenCluster;
      if (this.SelectedCluster != null)
      {
        this.SelectedCluster.isHighlighted = true;
      }
    }
    else
    {
      this.SelectedCluster.isHighlighted = false;
      this.SelectedCluster = chosenCluster;
      if (this.SelectedCluster != null)
      {
        this.SelectedCluster.isHighlighted = true;
      }
    }

    this.timeOfLastBoxSelect = Date.now();

    // add bounded patients to the BoxSelectPatients array
    for (let i = 0; i < boundedPatients.length; i++)
    {
      this.SelectedPatients.push(boundedPatients[i]);
    }
    this.SelectedPatients = Array.from(new Set(this.SelectedPatients));
    for (let i = 0; i < this.SelectedPatients.length; i++)
    {
      try
      {
        this.SelectedPatients[i].marker.getElement()?.classList.add('patient-icon-highlighted');
      }
      catch
      {

      }
      
    }
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
              //this.mapComponent.UpdateMapMarkers(this.Clusters);
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

        this.dataFrameLocations = new Array(this.dataFrame.length).fill([0,0]);
        for (let i = 0; i < this.dataFrame.length; i++)
        {
          let patient = new Patient();
          this.dataFrameLocations[i] = [parseFloat(this.dataFrame[i][this.LATITUDE]),parseFloat(this.dataFrame[i][this.LONGITUDE])];

          patient.latitude = parseFloat(this.dataFrame[i][this.LATITUDE]);
          patient.longitude = parseFloat(this.dataFrame[i][this.LONGITUDE]);        
          patient.patUID = this.dataFrame[i]["PatUID"] as string;
          patient.memberAddress = this.dataFrame[i]["MemberAddress"] as string;
          patient.city = this.dataFrame[i]["City"] as string;
          patient.state = this.dataFrame[i]["State"] as string;
          patient.zip = this.dataFrame[i]["Zip"] as string;
          patient.county = this.dataFrame[i]["County"] as string;
          this.patients.push(patient);
          // replace non numbers with 0
          if (isNaN(this.dataFrameLocations[i][0]))
          {
            console.log(`dataframe[${i}][Latitude]: ${this.dataFrame[i][this.LATITUDE]} is not a number`);
            this.dataFrameLocations[i] = [0,this.dataFrameLocations[i][1]];
          }
          if (isNaN(this.dataFrameLocations[i][1]))
          {
            console.log(`dataframe[${i}][Longitude]: ${this.dataFrame[i][this.LONGITUDE]} is not a number`);
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

  public CreateClusterFromSelectedPatients(event : any)
  {
    event.preventDefault();
    if (this.SelectedPatients.length <= 1)
    {
      return;
    }

    this.mapComponent.CreateClusterFromSelectedPatients(this.SelectedPatients);

    this.CancelPatientSelection();

  }

  public AutoPartitionCluster(event : any)
  {
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.mapComponent.PartitionCluster(this.SelectedCluster);
  }

  public RunKmeans(event : any,k:number)
  {
    event.preventDefault();
    if (this.SelectedCluster == null)
    {
      return;
    }
    this.ShowSpinner = true;
    this.loadLoggerService.LogMessage("");
    let patientLocations = [];
    for (let i = 0; i< this.SelectedCluster.patients.length; i++)
    {
      patientLocations.push(this.SelectedCluster.patients[i].location);
    }
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
          let labels = workerResponse.data.labels;

          console.log(labels);
          if (this.SelectedCluster != null)
          {
            this.SelectedCluster.isHighlighted = false;
            this.mapComponent.HandleKmeansResults(this.SelectedCluster,k,labels);
            this.SelectedCluster = null;
          }
          //this.mapComponent.UpdateMapMarkers(this.Clusters);
          this.loadLoggerService.LogMessage("");
          this.ShowSpinner = false;
        }


      };
      worker.postMessage({
        k:k,
        patientLocations:patientLocations
      });
    } else {
      // Web workers are not supported in this environment.
      // You should add a fallback so that your program still executes correctly.
      console.warn("Workers aren't available");
      this.loadLoggerService.LogMessage("Web Workers are unavailable in your browser",true);
      this.ShowSpinner = false;
    }
  }



  // called when user clicks on 'save clustered data'
  public SaveFile()
  {
    if (this.mapComponent.GetUnclusteredPatientCount() > 0)
    {
      alert("Every patient must be assigned to a cluster");
      return;
    }
    function arrayToCSV (data : any) {
      let csv = data.map((row : any) => Object.values(row));
      csv.unshift(Object.keys(data[0]));
      return `${csv.join('\n').replace(/,/g, ',')}`;
    }

    let clusters : Cluster[] = this.mapComponent.Clusters;

    // add new cluster column to dataframe
    for (let i = 0; i < this.dataFrame.length; i++)
    {
      let clusterIndex = 0;
      let patUID : string = this.dataFrame[i]["PatUID"] as string;
      let foundClusterWithPatient : boolean = false;
      for (clusterIndex = 0; clusterIndex < clusters.length; clusterIndex++)
      {
        let index = clusters[clusterIndex].patients.findIndex(patient => {
          return patient.patUID === patUID;
        })
        if (index >= 0)
        {
          foundClusterWithPatient = true;
          break;
        }
        
      }
      if (foundClusterWithPatient)
      {
        this.dataFrame[i]["cluster"] = clusterIndex;
      }
      else
      {
        console.log(`Lost patient ${patUID}`);
      }
      
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

  public RestoreClusters(event : any)
  {
    this.OnDeselect();
    this.mapComponent.RestoreClusters();
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

    if (this.patients.length == 0)
    {
      alert("No data to cluster");
      return;
    }

    // this.ShowSpinner = true;
    // this.loadLoggerService.LogMessage("");
    // let k = 2;
    // let patientLocations = [];
    
    // for (let i = 0; i< this.patients.length; i++)
    // {
    //   patientLocations.push(this.patients[i].location);
    // }
    // if (typeof Worker !== 'undefined') {
    //   // Create a new web worker to do the calculations
    //   const worker = new Worker(new URL('./app.worker', import.meta.url));
    //   worker.onmessage = ({data}) => {
    //     let workerResponse = data as WorkerResponse;
    //     if (workerResponse.status == Status.Progess)
    //     {
    //       this.loadLoggerService.LogMessage(workerResponse.message || "");
    //     }
    //     else if (workerResponse.status == Status.Error)
    //     {
    //       this.loadLoggerService.LogMessage(workerResponse.message || "",true);
    //       this.ShowSpinner = false;
    //     }
    //     else
    //     {

    //       let clusters = workerResponse.data.clusters;
    //       this.loadLoggerService.LogMessage("");
    //       this.ShowSpinner = false;
    //       this.mapComponent.DrawClusters(clusters);




    //       // let labels = workerResponse.data.labels;

    //       // console.log(labels);
    //       // if (this.SelectedCluster != null)
    //       // {
    //       //   this.SelectedCluster.isHighlighted = false;
    //       //   this.mapComponent.HandleKmeansResults(this.SelectedCluster,k,labels);
    //       //   this.SelectedCluster = null;
    //       // }
    //       // this.mapComponent.UpdateMapMarkers(this.Clusters);
    //       // this.loadLoggerService.LogMessage("");
    //       // this.ShowSpinner = false;
    //     }


    //   };
    //   worker.postMessage({
    //     k:k,
    //     patientLocations:patientLocations
    //   });
    // } else {
    //   // Web workers are not supported in this environment.
    //   // You should add a fallback so that your program still executes correctly.
    //   console.warn("Workers aren't available");
    //   this.loadLoggerService.LogMessage("Web Workers are unavailable in your browser",true);
    //   this.ShowSpinner = false;
    // }
    this.OnDeselect();

    this.mapComponent.ClearMarkers();
    // we subtract from the provided diameter value because the leaflet marker clusterer doesn't strictly enforce the given diameter
    let diameter = this.settingsForm.controls["maxDiameter"].value - 1.5;
    diameter = Math.max(1.0, diameter);
    this.mapComponent.CreateMarkerClusters(this.patients,diameter / 2.0);
    return;
    
  }

  private GetClusterMilage(cluster : Cluster) : Observable<any>
  {

    let locationsArray = [];
    for (let i = 0; i < cluster.patients.length; i++)
    {
      //mapbox expects longitude then latitude
      locationsArray.push([cluster.patients[i].longitude,cluster.patients[i].latitude]);
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

  CalculateInterquartileRange()
  {
    let latitudes = [];
    let longitudes = [];
    for (let i = 0; i < this.dataFrameLocations.length; i++)
    {
      latitudes.push(this.dataFrameLocations[i][0]);
      longitudes.push(this.dataFrameLocations[i][1]);
    }
    
  }

}

