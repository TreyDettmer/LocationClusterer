export class Patient
{
    private _latitude : number = 0.0;
    private _longitude : number = 0.0;
    private _patUID: string = "";
    private _zip: string = "";
    private _location : [number,number] = [0.0,0.0];
    private _memberAddress : string = "";
    private _city: string = "";
    private _state: string = "";
    private _county: string = "";




    

    public get county(): string {
        return this._county;
    }
    public set county(value: string) {
        this._county = value;
    }

    public get patUID(): string {
        return this._patUID;
    }
    public set patUID(value: string) {
        this._patUID = value;
    }

    public get zip(): string {
        return this._zip;
    }
    public set zip(value: string) {
        this._zip = value;
    }

    public get state(): string {
        return this._state;
    }
    public set state(value: string) {
        this._state = value;
    }

    public get city(): string {
        return this._city;
    }
    public set city(value: string) {
        this._city = value;
    }

    public set memberAddress(theMemberAddress : string)
    {
        this._memberAddress = theMemberAddress;
    }
  
    public get memberAddress() : string
    {
      return this._memberAddress;
    }

    public set longitude(theLongitude : number)
    {
        this._longitude = theLongitude;
        this.location = [this._latitude,this._longitude];
    }
  
    public get longitude() : number
    {
      return this._longitude;
    }

    public set latitude(theLatitude : number)
    {
        this._latitude = theLatitude;
        this.location = [this._latitude,this._longitude];
    }
  
    public get latitude() : number
    {
      return this._latitude;
    }

    public set location(theLocation : [number,number])
    {
        this._location = theLocation;
        this._latitude = this._location[0];
        this._longitude = this._location[1];
    }
  
    public get location() : [number,number]
    {
      return this._location;
    }
}