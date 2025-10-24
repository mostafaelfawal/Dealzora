"use client";

import { FC } from "react";
import { SiGoogle } from "react-icons/si";
import { GithubAuthProvider, GoogleAuthProvider } from "firebase/auth";
import { FaGithub } from "react-icons/fa";
import SochialButton from "./SochialButton";

const SocialLogin: FC = () => {
  return (
    <div className="flex gap-4">
      <SochialButton
        Icon={SiGoogle}
        provider={GoogleAuthProvider}
        title="Google"
      />
      <SochialButton
        Icon={FaGithub}
        provider={GithubAuthProvider}
        title="GitHub"
      />
    </div>
  );
};

export default SocialLogin;
