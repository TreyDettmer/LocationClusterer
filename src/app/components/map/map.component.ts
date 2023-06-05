import { AfterViewInit, Component, EventEmitter, OnInit, Output } from '@angular/core';
import * as L from 'leaflet';
import * as turf from '@turf/turf';
import { Cluster } from 'src/app/interfaces/cluster';
import { Patient } from 'src/app/interfaces/patient';
var classifyPoint = require('robust-point-in-polygon');







@Component({
  selector: 'app-map',
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.scss']
})
export class MapComponent implements AfterViewInit {


  private map : L.Map | any;
  private markers : L.FeatureGroup = new L.FeatureGroup();

  private largeClusterGroup : any;
  private Clusters : Cluster[] = [];

  private miniMarkers : L.FeatureGroup = new L.FeatureGroup();
  private icons : any = [];
  private miniIcons : any = [];
  private colors : string[] = ["#e6194B","#3cb44b","#ffe119","#4363d8","#f58231","#911eb4","#42d4f4","#f032e6","#bfef45","#fabed4","#469990","#dcbeff","#9A6324","#fffac8","#800000","#aaffc3","#808000","#ffd8b1","#000075","#a9a9a9"];

  @Output() OnInnerClusterPointClicked = new EventEmitter<{innerPointIndex : number, clusterIndex : number}>();
  @Output() OnClusterMouseOver = new EventEmitter<{clusterIndex : number}>();
  @Output() OnClusterMouseLeave = new EventEmitter<{clusterIndex : number}>();
  constructor() { }

  ngAfterViewInit(): void {
    this.initMap();
  }

  private initMap(): void 
  {
    this.map = L.map('map', {
      center: [ 39.8282, -98.5795 ],
      zoom: 4,
      layers: [this.markers,this.miniMarkers,Cluster.LeafletMarkerClustersGroup,Cluster.MappedPolygons]
    });

    const tiles : L.TileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      minZoom: 4,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });

    tiles.addTo(this.map);

    this.map.on("dblclick",(_:any) =>
    {
      this.miniMarkers.clearLayers();
    });

    this.map.on("zoomend",() =>
    {
      this.OnZoomChanged();
    });

    for (let i = 0; i < 25; i++)
    {

      let markerHtmlStyles = `
      background-color: ${this.colors[i % this.colors.length]};
      width: 1.25rem;
      height: 1.25rem;
      display: block;
      left: 0;
      top: 0;
      position: relative;
      border-radius: 1.25rem;
      border: 1px solid #FFFFFF`;

      let icon = L.divIcon({
        className: "map-pin",
        iconSize: [25,25],
        html: `<span style="${markerHtmlStyles}"/>`
      })

      let miniMarkerHtmlStyles = `
      background-color: ${this.colors[i % this.colors.length]};
      width: 1rem;
      height: 1rem;
      display: block;
      left: 0;
      top: 0;
      position: relative;
      border-radius: 1rem;
      border: 1px solid #FFFFFF`;

      let miniIcon = L.divIcon({
        className: "mini-pin-mini",
        iconSize: [10,10],
        html: `<span style="${miniMarkerHtmlStyles}" />`
      })
      this.icons.push(icon);
      this.miniIcons.push(miniIcon);
    }
    Cluster.Map = this.map;

  }

  /**
  * Gets distance in miles between two points on earth.
  * @param {number[]} origin
  * @param {number[]} destination
  */
  private distance(origin : any, destination : any) : number
  {
    let lat1 = origin[0];
    let lon1 = origin[1];
    let lat2 = destination[0];
    let lon2 = destination[1]

    let radius = 6371 // km
    let dlat = (lat2-lat1) * Math.PI/180.0
    let dlon = (lon2-lon1) * Math.PI/180.0
    let a = Math.sin(dlat/2) * Math.sin(dlat/2) + Math.cos(lat1 * Math.PI/180.0) * Math.cos(lat2 * Math.PI/180.0) * Math.sin(dlon/2) * Math.sin(dlon/2)

    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    let d = radius * c;
    // convert to miles
    d *=  0.621371;
    return d;
  }

  public PanTo(latLng : L.LatLng)
  {
    this.map.panTo(latLng);
  }

  public OnZoomChanged()
  {
    //console.log(`Zoom: ${this.map.getZoom()}`);
  }

  public CreateMarkerClusters(patients : Patient[])
  {
    Cluster.LeafletMarkerClustersGroup.clearLayers();

    let metersPerPixel = 40075016.686 * Math.abs(Math.cos(this.map.getCenter().lat * Math.PI/180)) / Math.pow(2, this.map.getZoom()+8);
    // 5 mile radius (1609 meters in a mile)
    
    let clusterRadius = 1609 * 5 / metersPerPixel;
    
    console.log(`Cluster Radius: ${clusterRadius} MetersPerPixel: ${metersPerPixel}`);
    this.largeClusterGroup = L.markerClusterGroup({
      removeOutsideVisibleBounds: true,
      zoomToBoundsOnClick: false,
      maxClusterRadius: clusterRadius
    });


    let miniMarkerHtmlStyles = `
    background-color: ${this.colors[0 % this.colors.length]};
    width: 1.25rem;
    height: 1.25rem;
    display: block;
    left: 0;
    top: 0;
    position: relative;
    border-radius: 1.25rem;
    border: 1px solid #FFFFFF;
    text-align: center;
    color: white;`;
    let miniIcon = L.divIcon({
      className: "mini-pin-mini",
      iconSize: [12,12],
      html: `<span style="${miniMarkerHtmlStyles}"></span>`
    });
    for (let i = 0; i < patients.length; i++)
    {
      var marker = L.marker(patients[i].location,{icon:miniIcon});
      this.largeClusterGroup.addLayer(marker);
    }

    this.largeClusterGroup.addTo(Cluster.LeafletMarkerClustersGroup);
    this.FindClusters(patients);
    // this.largeClusterGroup.on("clusterclick",(a: L.LeafletEvent) =>
    // {
    //   let polygon = L.polygon(a.propagatedFrom.getConvexHull())
    //   polygon.addTo(this.map);
    // })


  }

  public async FindClusters(patients : Patient[])
  {

    if (Cluster.LeafletMarkerClustersGroup.getLayers().length == 0)
    {
      return;
    }

    let markerClusters : L.MarkerCluster[] = [];
    this.map.eachLayer((layer : L.Layer) =>
    {
      if (layer instanceof L.MarkerCluster)
      {
        let cluster = new Cluster();
        
        let leafletMarkercluster = layer as L.MarkerCluster;

        leafletMarkercluster.on("click",()=>
        {  
          this.PartitionCluster(cluster);
        })

        cluster.leafletMarkerCluster = leafletMarkercluster;
        this.Clusters.push(cluster);

        markerClusters.push(leafletMarkercluster);

      }

    });
    console.log(`Found ${markerClusters.length} main clusters`);
    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

    // draw the shape/area of each cluster
    for (let i = 0; i < this.Clusters.length; i++)
    {

      let pointsForPolygon = [];
      let childMarkers = this.Clusters[i].leafletMarkerCluster.getAllChildMarkers();
      for (let j = 0; j < childMarkers.length; j++)
      {
        pointsForPolygon.push([childMarkers[j].getLatLng().lat,childMarkers[j].getLatLng().lng]);
      }
      let hull = this.convexHull(pointsForPolygon);

      let polygon = L.polygon(hull);
      polygon.addTo(this.map);
      let center = [polygon.getCenter().lat,polygon.getCenter().lng];
      polygon.removeFrom(this.map);
      // we need to scale up the shape slightly to fit the points that are on the edges
      
      let scaledHull = JSON.parse(JSON.stringify(hull));
      
      let scaleFactor = 1.05;
      for (let i = 0; i < scaledHull.length; i++)
      {
        scaledHull[i] = this.GetScaledPoint(scaledHull[i],center,scaleFactor);
      }
      this.Clusters[i].color = this.colors[i % this.colors.length];
      let scaledPolygon = L.polygon(scaledHull,{color:`${this.Clusters[i].color}`});

      this.Clusters[i].shape = scaledHull;
      this.Clusters[i].polygon = scaledPolygon;


      
      
    }
    console.log("starting to assign points to clusters");

    for (let patientIndex = 0; patientIndex < patients.length; patientIndex++)
    {
      let foundClusterForPoint : boolean = false;
      for (let clusterIndex = 0; clusterIndex < this.Clusters.length; clusterIndex++)
      {
        if (this.Clusters[clusterIndex].IsPointWithinCluster(patients[patientIndex].location))
        {
          this.Clusters[clusterIndex].patients.push(patients[patientIndex]);
          foundClusterForPoint = true;
          break;
        }

      }

      if (!foundClusterForPoint)
      {
        console.log(`Lost point ${patients[patientIndex].location}`);
        //this.clusters[this.clusters.length - 1].push(points[pointIndex]);
        var marker = L.marker(patients[patientIndex].location);
        marker.addTo(this.map);
      }
    }
    console.log(this.Clusters);
    //console.log(this.clusters);

  }

  private async PartitionCluster(cluster : Cluster)
  {
    if (cluster.hasBeenPartitioned)
    {
      console.warn("cluster has already been partitioned");
      return;
    }
    cluster.hasBeenPartitioned = true;

    const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
    this.map.fitBounds(cluster.leafletMarkerCluster.getBounds());
    // provide time for map to zoom in a generate internal cluster icons
    await delay(2000);



    let internalMarkerClusters : L.MarkerCluster[] = this.GetMarkerClustersWithinAreaOnMap(cluster.shape);
    let internalClusterCount = internalMarkerClusters.length;
    let indexOfStartOfInternalClusters = this.Clusters.length;

    for (let i = 0; i < internalMarkerClusters.length; i++)
    {
      let cluster = new Cluster();
      cluster.leafletMarkerCluster = internalMarkerClusters[i];
      cluster.leafletMarkerCluster.on("click",()=>
      {  
        this.PartitionCluster(cluster);
      })
      this.Clusters.push(cluster);
    }

    


    // store the shape of each internal cluster

    for (let i = indexOfStartOfInternalClusters; i < this.Clusters.length; i++)
    {
      let pointsForPolygon = [];
      let childMarkers = this.Clusters[i].leafletMarkerCluster.getAllChildMarkers();
      for (let j = 0; j < childMarkers.length; j++)
      {
        pointsForPolygon.push([childMarkers[j].getLatLng().lat,childMarkers[j].getLatLng().lng]);
      }
      let hull :any;
      if (pointsForPolygon.length == 2)
      {
   
        var enveloped = turf.envelope(turf.featureCollection([turf.point(pointsForPolygon[0]),turf.point(pointsForPolygon[1])]));

        hull = this.convexHull(enveloped.geometry.coordinates[0]);
      }
      else if (pointsForPolygon.length == 1)
      {
        var enveloped = turf.envelope(turf.featureCollection([turf.point(pointsForPolygon[0])]));
        hull = this.convexHull(enveloped.geometry.coordinates[0]);
      }
      else
      {
        hull = this.convexHull(pointsForPolygon);
      }
      

      let polygon = L.polygon(hull);
      polygon.addTo(this.map);
      let center = [polygon.getCenter().lat,polygon.getCenter().lng];
      polygon.removeFrom(this.map);
      // we need to scale up the shape slightly to fit the points that are on the edges
      
      let scaledHull = JSON.parse(JSON.stringify(hull));
      
      let scaleFactor = 1.05;
      for (let i = 0; i < scaledHull.length; i++)
      {
        scaledHull[i] = this.GetScaledPoint(scaledHull[i],center,scaleFactor);
      }
      this.Clusters[i].color = this.colors[i % this.colors.length];
      let scaledPolygon = L.polygon(scaledHull,{color:`${this.Clusters[i].color}`});
      this.Clusters[i].polygon = scaledPolygon;
      this.Clusters[i].shape = scaledHull;
      
    }
    console.log(`${internalClusterCount} new clusters created`);

    console.log(`Starting broaderclusterindex is ${indexOfStartOfInternalClusters}`);
    console.log(this.Clusters);
    let unassignedPatients : Patient[] = [];
    console.log(`About to map ${cluster.patients.length} points`);
    // partition points from the broader cluster into the smaller internal clusters
    // reverse for loop so we can remove points as we iterate
    for (let i = cluster.patients.length - 1; i >= 0; i--)
    {
      let point = cluster.patients[i].location;
      let foundClusterForPoint : boolean = false;
      for (let j = indexOfStartOfInternalClusters; j < this.Clusters.length; j++)
      {
        if (this.Clusters[j].IsPointWithinCluster(point))
        {
          this.Clusters[j].patients.push(cluster.patients[i]);
          foundClusterForPoint = true;
          break;
        }

      }

      if (!foundClusterForPoint)
      {
        unassignedPatients.push(cluster.patients[i]);
      }
      // remove patient from broader cluster
      cluster.patients.splice(i,1);

    }

    // find new cluster homes for unassigned Points
    for (let i = unassignedPatients.length - 1; i >=0; i--)
    {
      for (let j = 0; j < this.Clusters.length; j++)
      {
        if (this.Clusters[j].IsPointWithinCluster(unassignedPatients[i].location))
        {
          // add point to the cluster
          this.Clusters[j].patients.push(unassignedPatients[i]);
          unassignedPatients.splice(i,1);
          break;
        }

      }
    }
    if (unassignedPatients.length > 0)
    {
      console.log(`unassigned patients!`);
      console.log(unassignedPatients);
      for (let i = 0; i < unassignedPatients.length; i++)
      {
        var marker = L.marker(unassignedPatients[i].location);
        marker.addTo(this.map);
      }
    }

    if (cluster.patients.length == 0)
    {
      let clusterIndex = this.Clusters.indexOf(cluster);
      this.Clusters.splice(clusterIndex,1);
      cluster.Destroy();
    }
    else
    {
      this.ReconfigureClusterShape(cluster);
    }
    console.log(this.Clusters);

    let patientCount = 0;
    for (let i = 0; i < this.Clusters.length; i++)
    {
      patientCount += this.Clusters[i].patients.length;
    }
    console.log(`Patient count is ${patientCount}`);

  }

  private ReconfigureClusterShape(cluster : Cluster)
  {
    let pointsForPolygon = [];
    let childMarkers = cluster.leafletMarkerCluster.getAllChildMarkers();
    for (let j = 0; j < childMarkers.length; j++)
    {
      pointsForPolygon.push([childMarkers[j].getLatLng().lat,childMarkers[j].getLatLng().lng]);
    }
    let hull :any;
    if (pointsForPolygon.length == 2)
    {
  
      var enveloped = turf.envelope(turf.featureCollection([turf.point(pointsForPolygon[0]),turf.point(pointsForPolygon[1])]));

      hull = this.convexHull(enveloped.geometry.coordinates[0]);
    }
    else if (pointsForPolygon.length == 1)
    {
      var enveloped = turf.envelope(turf.featureCollection([turf.point(pointsForPolygon[0])]));
      hull = this.convexHull(enveloped.geometry.coordinates[0]);
    }
    else
    {
      hull = this.convexHull(pointsForPolygon);
    }
    

    let polygon = L.polygon(hull);
    polygon.addTo(this.map);
    let center = [polygon.getCenter().lat,polygon.getCenter().lng];
    polygon.removeFrom(this.map);
    // we need to scale up the shape slightly to fit the points that are on the edges
    
    let scaledHull = JSON.parse(JSON.stringify(hull));
    
    let scaleFactor = 1.05;
    for (let i = 0; i < scaledHull.length; i++)
    {
      scaledHull[i] = this.GetScaledPoint(scaledHull[i],center,scaleFactor);
    }
    let scaledPolygon = L.polygon(scaledHull,{color:`${cluster.color}`});
    cluster.polygon = scaledPolygon;
    cluster.shape = scaledHull;
  }

  private GetScaledPoint(point : any[], center : any[], scaleFactor : number) : any[]
  {
    let v2 = [point[0] - center[0],point[1] - center[1]];
    let v2_scaled = [v2[0] * scaleFactor,v2[1] * scaleFactor];
    let v1_scaled = [v2_scaled[0] + center[0],v2_scaled[1] + center[1]];
    return v1_scaled;
  }

  private GetMarkerClustersWithinAreaOnMap(shape : any) : L.MarkerCluster[]
  {
    let internalMarkerClusters : L.MarkerCluster[] = [];
    this.map.eachLayer((layer : L.Layer) => {
        // this will get the new clusters formed by zooming in on the cluster
        if( (layer instanceof L.MarkerCluster || layer instanceof L.Marker))
        {
          // ensure that this layer is actually inside of the broader cluster area
          let isInside = classifyPoint(shape,[layer.getLatLng().lat,layer.getLatLng().lng]);
          if (isInside == -1 || isInside == 0)
          {
            if (layer instanceof L.MarkerCluster)
            {
              internalMarkerClusters.push(layer as L.MarkerCluster);
            }
          }

        }
      }
    );
    return internalMarkerClusters;
  }


  // // Recursive function to get all of the clusters
  // public async GetInternalClusters(markerCluster : L.MarkerCluster)
  // {
  //   const delay = (ms: number) => new Promise(res => setTimeout(res, ms));
  //   let clusterChildCount = markerCluster.getChildCount();
    
  //   // check if cluster is small enough to store
  //   if (clusterChildCount < 905)
  //   {
  //     if (clusterChildCount > 800)
  //     {
  //       this.largeClusterGroup.fireEvent("clusterclick",{latlng:[markerCluster.getLatLng().lng,markerCluster.getLatLng().lat]})
  //       //markerCluster.fireEvent("clusterclick");
  //       this.clustersBounds.push(markerCluster.getBounds());
  //     }
  //     // let childMarkers : L.Marker<any>[] = markerCluster.getAllChildMarkers();
  //     // let points = [];
  //     // for (let i = 0; i < childMarkers.length; i++)
  //     // {
  //     //   points.push([childMarkers[i].getLatLng().lat,childMarkers[i].getLatLng().lng]);
  //     // }

  //     // this.clusters.push(points);
  //     this.pointsLogged += markerCluster.getChildCount();
  //     // this.pointsLogged += points.length;
  //     // console.log(`removed cluster with child count ${clusterChildCount}`);
  //     markerCluster.setOpacity(0);
  //   }
  //   else
  //   {
  //     return;

      
  //     this.map.fitBounds(markerCluster.getBounds());
  //     await delay(2000);
  //     let internalClusters : L.MarkerCluster[] = []
  //     let visibleClusters : L.MarkerCluster[] = []
  //     this.map.eachLayer((layer : L.Layer) => {
  //       // this will get the new clusters formed by zooming in on the cluster
  //       if( (layer instanceof L.MarkerCluster || layer instanceof L.Marker) && markerCluster.getBounds().contains(layer.getLatLng()) )
  //       {
  //         if (layer instanceof L.MarkerCluster)
  //         {
  //           internalClusters.push(layer);
  //         }
  //         else
  //         {
  //           //console.log(`Removed 1`);
  //           //this.pointsLogged += 1;
  //           //layer.setOpacity(0);
  //         }
          
  //       }
  //       if( layer instanceof L.MarkerCluster && this.map.getBounds().contains(layer.getLatLng()) )
  //       {
  //         visibleClusters.push(layer);
  //       }
  //     })

  //     //console.log(`Visible Clusters: ${visibleClusters.length} Internal Clusters: ${internalClusters.length}`);

  //     for (let i = 0; i < internalClusters.length; i++)
  //     {
  //       //let bounds = this.map.getBounds();
  //       // recursive call
  //       await this.GetInternalClusters(internalClusters[i]);
  //       console.log(`Points logged: ${this.pointsLogged}`);
  //       // this.map.fitBounds(bounds);
  //       // await delay(2000);
  //     }
  //     markerCluster.setOpacity(0);
  //   }
  // }

  

  public DrawRoute(waypoints : any)
  {
    var latlngs = [];
    for (let i = 0; i < waypoints.length; i++)
    {
      latlngs.push([waypoints[i].location[1],waypoints[i].location[0]]);
    }
    var polyline = L.polyline(latlngs,{color: 'red'}).addTo(this.markers);
  }

  public ClearMarkers()
  {
    this.markers.clearLayers();
    this.miniMarkers.clearLayers();
    Cluster.LeafletMarkerClustersGroup.clearLayers();
    Cluster.MappedPolygons.clearLayers();
  }

  public UpdateMapCenter(points : any)
  {
    let averageLatitude : number = 0;
    let averageLongitude : number = 0;
    for (let row = 0; row < points.length; row++)
    {
      averageLatitude += points[row][0];
      averageLongitude += points[row][1];
    }
    averageLatitude /= points.length;
    averageLongitude /= points.length;
    this.map.panTo(new L.LatLng(averageLatitude, averageLongitude));
  }

  public DisplayPointsInCluster(clusters : any, clusterIndex:number)
  {
    this.miniMarkers.clearLayers();
    let clusterGroup = L.markerClusterGroup({removeOutsideVisibleBounds: true});
    let cluster = clusters[clusterIndex];
    let displayedMiniMarkerCopies : any[] = new Array(cluster.length).fill(0);
    let shouldDisplayMiniMarker : any[] = new Array(cluster.length).fill(true);
    for (let i = 0; i < cluster.length; i++)
    {
      let j = 0;
      for (j = 0; j < i; j++)
      {
        // check if point is the same
        if (cluster[j][0] == cluster[i][0] && cluster[j][1] == cluster[i][1])
        {
          displayedMiniMarkerCopies[j] += 1;
          shouldDisplayMiniMarker[i] = false;
          break;
        }
      }

    }
    let num = 0;
    for (let i = 0; i < cluster.length; i++)
    {
      if (shouldDisplayMiniMarker[i])
      {
        num++;
        let miniMarkerHtmlStyles = `
        background-color: ${this.colors[clusterIndex % this.colors.length]};
        width: 1.25rem;
        height: 1.25rem;
        display: block;
        left: 0;
        top: 0;
        position: relative;
        border-radius: 1.25rem;
        border: 1px solid #FFFFFF;
        text-align: center;
        color: white;`;
        let miniIcon : L.DivIcon;
        if (displayedMiniMarkerCopies[i] > 0)
        {
          miniIcon = L.divIcon({
            className: "mini-pin-mini",
            iconSize: [12,12],
            html: `<span style="${miniMarkerHtmlStyles}">${displayedMiniMarkerCopies[i] + 1}</span>`
          })
        }
        else
        {
          miniIcon = L.divIcon({
            className: "mini-pin-mini",
            iconSize: [12,12],
            html: `<span style="${miniMarkerHtmlStyles}"></span>`
          });
        }
        var marker = L.marker([cluster[i][0],cluster[i][1]],{icon:miniIcon});
        marker.on("click",(e) =>
        {
          this.InnerClusterPointClicked(i,clusterIndex);
        });
        clusterGroup.addLayer(marker);
        //marker.addTo(this.miniMarkers);
      }
    }
    clusterGroup.addTo(this.miniMarkers);
    console.log(`${num} points displayed`);
  }

  public GraphPointsByZipCodes(dataFrame : any)
  {
    for (let i = 0; i < dataFrame.length; i++)
    {
      //let Lat = 
    }
  }

  public InnerClusterPointClicked(innerPointIndex : number, clusterIndex : number)
  {
    this.OnInnerClusterPointClicked.emit({innerPointIndex,clusterIndex});
  }


  private getAveragePoint(points : any) : [number, number]
  {
    let averageLatitude : number = 0;
    let averageLongitude : number = 0;
    for (let row = 0; row < points.length; row++)
    {
      averageLatitude += points[row][0];
      averageLongitude += points[row][1];
    }
    averageLatitude /= points.length;
    averageLongitude /= points.length;
    return [averageLatitude,averageLongitude];
  }

  private cross(a : any, b : any, o : any) {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  }
 

  private convexHull(points: any) 
  {
    points.sort(function(a : any, b : any) {
       return a[0] == b[0] ? a[1] - b[1] : a[0] - b[0];
    });
 
    var lower = [];
    for (var i = 0; i < points.length; i++) {
       while (lower.length >= 2 && this.cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
          lower.pop();
       }
       lower.push(points[i]);
    }
 
    var upper = [];
    for (var i = points.length - 1; i >= 0; i--) {
       while (upper.length >= 2 && this.cross(upper[upper.length - 2], upper[upper.length - 1], points[i]) <= 0) {
          upper.pop();
       }
       upper.push(points[i]);
    }
 
    upper.pop();
    lower.pop();
    return lower.concat(upper);
  }


}
