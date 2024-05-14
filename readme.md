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

Add the Github Package Registry to your settings.xml file and adjust the repository in the pom.xml accordingly.
See: https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-apache-maven-registry

The Demo will call the API on the inSign-Sandbox demo system located at https://sandbox.test.getinsign.show/

Now you can run a maven build to download and use the required artifacts from the private iS2 repository.<br/>
If you are using Eclipse, this is done by right-clicking on the project ➜ `Run As` ➜ `Maven install`.<br/>
After that right click again and run ➜ `Maven` ➜ `Update project`.

After the `Maven install` command execution there will be a second package in your java source folder.
This package includes several java classes demonstrating advanced usage. In order to be able to run these
examples you have to input the same data as above in `ApiData.java`.


## Run it

Find the complete Swagger API documentation here:
https://sandbox.test.getinsign.show/docs

Login as controller:pwd.insign.sandbox.4561


## API calls

### Authentication

Authentication is done via basic auth Authorization Http Header.

### API Endpoints

#### /configure/session

##### Docs: 
https://sandbox.test.getinsign.show/docs/swagger-ui/index.html#/Most%20common/configuredocumentsUsingPOST
Hint: fileURL may have changed

##### payload:

```json
{
    "foruser":"session-owner-userid",
    "displayname":"demo session",
    "documents":[
        {
            "id":"document-id-1",
            "displayname":"my document",
            "fileURL":"https://github.com/getinsign/insign-getting-started/blob/8e7b3eebe8e7a75200fb5fd06956fea49365af40/src/test/resources/test.pdf"
        }
    ]
}
```
##### CURL

```
curl -X POST "https://sandbox.test.getinsign.show/configure/session" -H "accept: application/json" -H "authorization: Basic Y29udHJvbGxlcjpwd2QuaW5zaWduLnNhbmRib3guNDU2MQ==" -H "Content-Type: application/json" -d "{ \"foruser\":\"session-owner-userid\", \"displayname\":\"demo session\", \"documents\":[ { \"id\":\"document-id-1\", \"displayname\":\"my document\", \"fileURL\":\"https://github.com/getinsign/insign-getting-started/blob/8e7b3eebe8e7a75200fb5fd06956fea49365af40/src/test/resources/test.pdf\" } ]}"
```

##### Postman

You can use a postman collection to make the API calls. Find the collection here [Getting started with inSign Postnman Collection](DEV/Getting%20started%20with%20inSign%20Postnman%20Collection.postman_collection.json).
You can use the configured envirement [InsinEnv](DEV/inSign%20Env.postman_environment.json). Or create your own envirement.
The collection is already configured with authentication and API calls.

## Usage

Now you should be able to run the SimpleDemo as a java application. If everything was set up correctly your browser will be opened and show the test document.

## Developed By

[inSign GmbH](https://www.getinsign.de/)
