import {NextResponse} from 'next/server';
import {query} from '../../../server/db';
import {assertConfiguration} from '../../../server/config';
export const dynamic='force-dynamic';
export async function GET(){
 try{assertConfiguration();await query('SELECT 1');return NextResponse.json({status:'ok'});}
 catch{return NextResponse.json({status:'unavailable'},{status:503});}
}
