import LoginForm from "../../components/login-form";
import {isMock} from "../../server/config";
export const dynamic = "force-dynamic";
export default function Login(){
 return <LoginForm demo={process.env.NODE_ENV !== "production" && isMock() && process.env.DEMO_AUTH === "true"}/>;
}
