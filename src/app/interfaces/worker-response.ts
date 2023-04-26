export interface WorkerResponse
{
    status? : Status;
    message? : string;
    data? : any;
}

export enum Status
{
    Complete,
    Progess,
    Error
}