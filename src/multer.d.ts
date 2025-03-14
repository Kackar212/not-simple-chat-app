declare namespace Express {
  export namespace Multer {
    export interface File extends Express.Multer.File {
      width: number;
      height: number;
      poster?: string;
    }
  }
}
