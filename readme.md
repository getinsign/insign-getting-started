[<img src="./DEV/inSign_logo.svg" width="300" />](https://www.getinsign.com/)
------

# Getting started

This java project will aid you in getting started with the inSign java-api implementation.
It consists of the following parts:

* A settings.xml file with the url and some basic credentials to access the java-api artifacts from the private iS2 maven repository.
* A minimal pom.xml importing the needed the insign-java-api.jar.
* A SimpleDemo.java class that shows some basic usage of the API.

## Setup

The following steps are required for the setup:

First copy the `settings.xml` into you local `C:\Users\YOUR.USERNAME\.m2\` folder if it does not exist yet. If you already have a config file make sure to add the content of `settings.xml` to your already existing file.<br />
This lets you access the inSign dependencies from the private iS2 maven repository.

The Demo will call the API on the inSign-Sandbox demo system located at https://sandbox.test.getinsign.show/

Now you can run a maven build to download and use the required artifacts from the private iS2 repository.<br/>
If you are using Eclipse, this is done by right-clicking on the project ➜ `Run As` ➜ `Maven install`.<br/>
After that right click again and run ➜ `Maven` ➜ `Update project`.

After the `Maven install` command execution there will be a second package in your java source folder.
This package includes several java classes demonstrating advanced usage. In order to be able to run these
examples you have to input the same data as above in `ApiData.java`.


## Run it

Find the complete Swagger API documentation here:
https://sandbox.insign.is2.show/docs

Login as controller:pwd.insign.sandbox.4561


## API calls

### Authentication

Authentication is done via basic auth Authorization Http Header.

### API Endpoints

#### /configure/session

##### Docs: 
https://sandbox.test.getinsign.show/docs/swagger-ui/index.html#/Most%20common/configuredocumentsUsingPOST

##### payload:

```json
{
    "foruser":"session-owner-userid",
    "displayname":"demo session",
    "documents":[
        {
            "id":"document-id-1",
            "displayname":"my document",
            "fileURL":"https://github.com/iS2-inSign/inSign-getting-started/raw/main/src/main/resources/test.pdf"
        }
    ]
}
```
##### CURL

```
curl -X POST "https://sandbox.test.getinsign.show/configure/session" -H "accept: application/json" -H "authorization: Basic Y29udHJvbGxlcjpwd2QuaW5zaWduLnNhbmRib3guNDU2MQ==" -H "Content-Type: application/json" -d "{ \"foruser\":\"session-owner-userid\", \"displayname\":\"demo session\", \"documents\":[ { \"id\":\"document-id-1\", \"displayname\":\"my document\", \"fileURL\":\"https://github.com/iS2-inSign/inSign-getting-started/raw/main/src/main/resources/test.pdf\" } ]}"
```

## Usage

Now you should be able to run the SimpleDemo as a java application. If everything was set up correctly your browser will be opened and show the test document.

## Developed By

[inSign GmbH](https://www.getinsign.de/)
