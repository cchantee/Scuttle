export interface Interface {number:string;label:string;branch:string;folder:string;port:number}
export interface ResolvedInterface extends Interface {directory:string;primaryRoot:string;exists:boolean}
export const INTERFACES: Interface[];
export function parseWorktrees(output:string): {directory?:string;branch?:string}[];
export function resolveInterfaces(root:string): ResolvedInterface[];
export function expoEnvironment(directory:string,primaryRoot:string,inherited?:Record<string,string|undefined>):Record<string,string|undefined>;
export function dependencyFingerprint(directory:string):string;
export function prepareInterface(item:ResolvedInterface,root:string,install?:(command:string,args:string[],options:{cwd:string})=>Promise<{code:number|null;signal?:string|null}>):Promise<void>;
export function expoArguments(item:ResolvedInterface,tunnel?:boolean):string[];
export function main(args?:string[]):Promise<void>;

export function availableExpoPort(preferred:number,check?:(port:number)=>Promise<void>):Promise<number>;
